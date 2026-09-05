import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { appConfig, type AppConfig } from '../../config/app.config';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, type AuthResult } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

export const REFRESH_COOKIE_NAME = 'sc_refresh';

const CREDENTIAL_THROTTLE = { default: { limit: 10, ttl: 60_000 } };
const REFRESH_THROTTLE = { default: { limit: 60, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('register')
  @ApiOperation({ summary: 'Create an account and start a session' })
  @ApiOkResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(await this.authService.register(dto), response);
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(await this.authService.login(dto), response);
  }

  @Public()
  @Throttle(CREDENTIAL_THROTTLE)
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with a Google ID token' })
  @ApiOkResponse({ type: AuthResponseDto })
  async google(
    @Body() dto: GoogleSignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    return this.respondWithSession(await this.authService.signInWithGoogle(dto), response);
  }

  @Public()
  @Throttle(REFRESH_THROTTLE)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange the refresh cookie for a new access token' })
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const token = this.readRefreshCookie(request);
    return this.respondWithSession(await this.authService.refresh(token), response);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.readRefreshCookie(request));
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  private readRefreshCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[REFRESH_COOKIE_NAME];
  }

  private respondWithSession(result: AuthResult, response: Response): AuthResponseDto {
    response.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.tokenService.refreshTokenTtlMs,
    });

    return result.response;
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: this.config.isProduction ? 'none' : 'lax',
      secure: this.config.isProduction,
      domain: this.config.cookieDomain,
      path: '/',
    };
  }
}
