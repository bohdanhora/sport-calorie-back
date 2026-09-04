import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Intensity } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';

const MAX_DURATION_SEC = 86_400;
const MAX_DISTANCE_M = 300_000;
const MAX_SPEED_KMH = 60;
const MAX_INCLINE_PERCENT = 40;
const MAX_SETS = 100;
const MAX_REPS = 5000;
const MAX_ENERGY_KCAL = 10_000;

export class CreateActivityEntryDto {
  @ApiProperty()
  @IsUUID()
  activityTypeId!: string;

  @ApiPropertyOptional({ example: 'WalkingPad' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @ApiPropertyOptional({ example: 2700, description: 'Duration in seconds' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_DURATION_SEC)
  durationSec?: number | null;

  @ApiPropertyOptional({ example: 3700, description: 'Distance in metres' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(MAX_DISTANCE_M)
  distanceM?: number | null;

  @ApiPropertyOptional({ example: 4.9, description: 'Average speed in km/h' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(MAX_SPEED_KMH)
  avgSpeedKmh?: number | null;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_INCLINE_PERCENT)
  inclinePercent?: number | null;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_SETS)
  sets?: number | null;

  @ApiPropertyOptional({ example: 80, description: 'Total repetitions across all sets' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_REPS)
  reps?: number | null;

  @ApiPropertyOptional({ enum: Intensity })
  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity | null;

  @ApiPropertyOptional({
    example: 210,
    nullable: true,
    description: 'Replaces the estimate with a measured value, null keeps the estimate',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_ENERGY_KCAL)
  energyKcal?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;

  @ApiPropertyOptional({ example: '2026-03-02' })
  @IsOptional()
  @IsLocalDate()
  date?: string;

  @ApiPropertyOptional({ description: 'Exact moment the activity was performed' })
  @IsOptional()
  @IsISO8601()
  performedAt?: string;
}

export class UpdateActivityEntryDto extends PartialType(CreateActivityEntryDto) {}

export class EstimateActivityEnergyDto extends OmitType(CreateActivityEntryDto, [
  'title',
  'notes',
  'energyKcal',
  'performedAt',
] as const) {}
