import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { IsTimeZone } from '../../../common/validation/is-time-zone.validator';
import { SUPPORTED_LOCALES } from '../../nutrition-provider/dto/parse-food.dto';

export class GoogleSignInDto {
  @ApiProperty({ description: 'The ID token issued by Google Identity Services' })
  @IsString()
  @MinLength(1)
  idToken!: string;

  @ApiPropertyOptional({ example: 'Europe/Kyiv', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}
