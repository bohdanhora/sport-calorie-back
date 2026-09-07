import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Safari on iOS refuses the refresh cookie outright when the API and the app are
 * on unrelated domains, so a browser that cannot keep the cookie sends the token
 * back in the body instead. The cookie still wins wherever it survives.
 */
export class SessionTokenDto {
  @ApiPropertyOptional({ description: 'The refresh token, when the cookie could not be stored' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  refreshToken?: string;
}
