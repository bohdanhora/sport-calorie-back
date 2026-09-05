import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Intensity } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SUPPORTED_LOCALES = ['en', 'ru', 'uk'] as const;

export class ParseActivityDto {
  @ApiProperty({ example: '700 skips with rests' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  text!: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}

export class ParsedActivityDto {
  @ApiProperty()
  activityTypeId!: string;

  @ApiProperty({ example: 'Jump rope' })
  activityTypeName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  title!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 900 })
  durationSec!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  distanceM!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  avgSpeedKmh!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  inclinePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  sets!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 700 })
  reps!: number | null;

  @ApiPropertyOptional({ enum: Intensity, nullable: true })
  intensity!: Intensity | null;

  @ApiProperty({
    example: 168,
    description: 'Calculated by the same estimator the form uses, not by the model.',
  })
  energyKcal!: number;

  @ApiProperty({ example: 900 })
  effectiveDurationSec!: number;
}
