import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IsTimeZone } from '../../../common/validation/is-time-zone.validator';
import { SUPPORTED_LOCALES } from '../../nutrition-provider/dto/parse-food.dto';

export class RegisterDto {
  @ApiProperty({ example: 'me@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'correct horse battery' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'Bohdan' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({ example: 'Europe/Kyiv', default: 'UTC' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}
