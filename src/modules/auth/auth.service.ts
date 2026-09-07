import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { GoogleSignInDto } from './dto/google-sign-in.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { GoogleIdentityService, type GoogleIdentity } from './google-identity.service';
import { TokenService } from './token.service';

const PASSWORD_SALT_ROUNDS = 12;
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_LOCALE = 'en';

const PROFILE_SESSION = { displayName: true, timezone: true, locale: true } as const;

export interface AuthResult {
  /** The controller adds the refresh token once it has also set the cookie. */
  response: Omit<AuthResponseDto, 'refreshToken'>;
  refreshToken: string;
}

interface GoogleUser {
  id: string;
  email: string;
  googleId: string | null;
  profile: { displayName: string | null; timezone: string; locale: string } | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly googleIdentity: GoogleIdentityService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hash(dto.password, PASSWORD_SALT_ROUNDS),
        profile: {
          create: {
            displayName: dto.displayName?.trim() || null,
            timezone: dto.timezone ?? DEFAULT_TIMEZONE,
            locale: dto.locale ?? DEFAULT_LOCALE,
          },
        },
      },
      select: {
        id: true,
        email: true,
        profile: { select: { displayName: true, timezone: true, locale: true } },
      },
    });

    return this.buildAuthResult({
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      timezone: user.profile?.timezone ?? DEFAULT_TIMEZONE,
      locale: user.profile?.locale ?? DEFAULT_LOCALE,
    });
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        profile: { select: { displayName: true, timezone: true, locale: true } },
      },
    });

    const passwordMatches = user?.passwordHash
      ? await compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    return this.buildAuthResult({
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      timezone: user.profile?.timezone ?? DEFAULT_TIMEZONE,
      locale: user.profile?.locale ?? DEFAULT_LOCALE,
    });
  }

  async signInWithGoogle(dto: GoogleSignInDto): Promise<AuthResult> {
    const identity = await this.googleIdentity.verify(dto.idToken);
    const user = await this.resolveGoogleUser(identity, dto);

    return this.buildAuthResult({
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      timezone: user.profile?.timezone ?? DEFAULT_TIMEZONE,
      locale: user.profile?.locale ?? DEFAULT_LOCALE,
    });
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const active = await this.tokenService.findActiveToken(refreshToken);

    if (!active) {
      throw new UnauthorizedException('Session expired, sign in again');
    }

    await this.tokenService.rotateRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: active.userId },
      select: {
        id: true,
        email: true,
        profile: { select: { displayName: true, timezone: true, locale: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Session expired, sign in again');
    }

    return this.buildAuthResult({
      id: user.id,
      email: user.email,
      displayName: user.profile?.displayName ?? null,
      timezone: user.profile?.timezone ?? DEFAULT_TIMEZONE,
      locale: user.profile?.locale ?? DEFAULT_LOCALE,
    });
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
  }

  private async resolveGoogleUser(
    identity: GoogleIdentity,
    dto: GoogleSignInDto,
  ): Promise<GoogleUser> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: identity.googleId }, { email: identity.email }] },
      select: { id: true, email: true, googleId: true, profile: { select: PROFILE_SESSION } },
    });

    // Google has verified the address, so an account created with a password can
    // be linked to it rather than turned into a duplicate.
    if (existing) {
      if (existing.googleId === identity.googleId && existing.profile?.displayName) {
        return existing;
      }

      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: identity.googleId,
          profile: {
            update: { displayName: existing.profile?.displayName ?? identity.displayName },
          },
        },
        select: { id: true, email: true, googleId: true, profile: { select: PROFILE_SESSION } },
      });
    }

    return this.prisma.user.create({
      data: {
        email: identity.email,
        googleId: identity.googleId,
        profile: {
          create: {
            displayName: identity.displayName,
            timezone: dto.timezone ?? DEFAULT_TIMEZONE,
            locale: dto.locale ?? DEFAULT_LOCALE,
          },
        },
      },
      select: { id: true, email: true, googleId: true, profile: { select: PROFILE_SESSION } },
    });
  }

  private async buildAuthResult(user: {
    id: string;
    email: string;
    displayName: string | null;
    timezone: string;
    locale: string;
  }): Promise<AuthResult> {
    const accessToken = this.tokenService.signAccessToken({ sub: user.id, email: user.email });
    const refresh = await this.tokenService.issueRefreshToken(user.id);

    return {
      refreshToken: refresh.token,
      response: {
        accessToken,
        expiresIn: this.tokenService.accessTokenTtlSeconds,
        user,
      },
    };
  }
}
