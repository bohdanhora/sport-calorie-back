import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

import { googleConfig, type GoogleConfig } from '../../config/app.config';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  displayName: string | null;
}

@Injectable()
export class GoogleIdentityService {
  private readonly client: OAuth2Client;

  constructor(@Inject(googleConfig.KEY) private readonly config: GoogleConfig) {
    this.client = new OAuth2Client(config.clientId);
  }

  get isEnabled(): boolean {
    return this.config.isEnabled;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.config.isEnabled) {
      throw new ServiceUnavailableException('Google sign-in is not configured');
    }

    const ticket = await this.client
      .verifyIdToken({ idToken, audience: this.config.clientId })
      .catch(() => null);

    const payload = ticket?.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Could not verify the Google account');
    }

    // An unverified address could belong to somebody else, so it must never be
    // matched against an existing password account.
    if (!payload.email_verified) {
      throw new UnauthorizedException('This Google account has no verified email address');
    }

    return {
      googleId: payload.sub,
      email: payload.email.trim().toLowerCase(),
      displayName: payload.name?.trim() || null,
    };
  }
}
