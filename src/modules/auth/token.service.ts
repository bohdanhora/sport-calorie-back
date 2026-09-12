import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { jwtConfig, type JwtConfig } from '../../config/app.config';
import { parseDurationToMs } from '../../common/duration';
import { PrismaService } from '../../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

const REFRESH_TOKEN_BYTES = 48;

const ROTATION_GRACE_MS = 60_000;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(jwtConfig.KEY) private readonly config: JwtConfig,
  ) {}

  get accessTokenTtlSeconds(): number {
    return Math.floor(parseDurationToMs(this.config.accessTtl) / 1000);
  }

  get refreshTokenTtlMs(): number {
    return parseDurationToMs(this.config.refreshTtl);
  }

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.config.accessSecret,
      expiresIn: this.accessTokenTtlSeconds,
    });
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueRefreshToken(userId: string): Promise<IssuedRefreshToken> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashRefreshToken(token), expiresAt },
    });

    return { token, expiresAt };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashRefreshToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async rotateRefreshToken(token: string): Promise<void> {
    const now = new Date();

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashRefreshToken(token), revokedAt: null },
      data: { revokedAt: now, rotatedAt: now },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findActiveToken(token: string): Promise<{ id: string; userId: string } | null> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashRefreshToken(token) },
      select: { id: true, userId: true, revokedAt: true, rotatedAt: true, expiresAt: true },
    });

    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    if (stored.revokedAt !== null && !this.isWithinRotationGrace(stored.rotatedAt)) {
      return null;
    }

    return { id: stored.id, userId: stored.userId };
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return result.count;
  }

  private isWithinRotationGrace(rotatedAt: Date | null): boolean {
    return rotatedAt !== null && Date.now() - rotatedAt.getTime() < ROTATION_GRACE_MS;
  }
}
