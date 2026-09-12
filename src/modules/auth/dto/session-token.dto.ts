import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SessionTokenDto {
  @ApiPropertyOptional({ description: 'The refresh token, when the cookie could not be stored' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  refreshToken?: string;
}
