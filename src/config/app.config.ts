import { registerAs } from '@nestjs/config';

import { deriveEncryptionKey } from '../common/crypto/secret-cipher';
import { NodeEnvironment } from './environment';

export interface AppConfig {
  environment: NodeEnvironment;
  port: number;
  corsOrigins: string[];
  logLevel: string;
  cookieDomain?: string;
  isProduction: boolean;
}

export interface SecurityConfig {
  encryptionKey: Buffer;
}

export interface GoogleConfig {
  clientId: string;
  isEnabled: boolean;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessTtl: string;
  refreshTtl: string;
}

export const appConfig = registerAs<AppConfig>('app', () => {
  const environment = (process.env.NODE_ENV as NodeEnvironment) ?? NodeEnvironment.Development;

  return {
    environment,
    port: Number(process.env.PORT ?? 4000),
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    cookieDomain: process.env.COOKIE_DOMAIN,
    isProduction: environment === NodeEnvironment.Production,
  };
});

export const securityConfig = registerAs<SecurityConfig>('security', () => ({
  encryptionKey: deriveEncryptionKey(process.env.ENCRYPTION_KEY ?? ''),
}));

export const googleConfig = registerAs<GoogleConfig>('google', () => {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';

  return { clientId, isEnabled: clientId.length > 0 };
});

export const jwtConfig = registerAs<JwtConfig>('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
}));
