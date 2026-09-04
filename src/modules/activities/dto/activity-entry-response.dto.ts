import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnergySource, Intensity } from '@prisma/client';

import { ActivityTypeDto } from './activity-type-response.dto';

export class ActivityEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: ActivityTypeDto })
  activityType!: ActivityTypeDto;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'WalkingPad' })
  title!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2700 })
  durationSec!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 3700 })
  distanceM!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 4.93 })
  avgSpeedKmh!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  inclinePercent!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  sets!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  reps!: number | null;

  @ApiPropertyOptional({ enum: Intensity, nullable: true })
  intensity!: Intensity | null;

  @ApiProperty({ example: 211 })
  energyKcal!: number;

  @ApiProperty({ enum: EnergySource })
  energySource!: EnergySource;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  performedAt!: string;

  @ApiProperty({ example: '2026-03-02' })
  date!: string;
}

export class ActivityEnergyEstimateDto {
  @ApiProperty({ example: 211 })
  energyKcal!: number;

  @ApiProperty({ example: 3.35 })
  met!: number;

  @ApiProperty({ example: 2700 })
  effectiveDurationSec!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 3700 })
  distanceM!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 4.93 })
  avgSpeedKmh!: number | null;

  @ApiProperty({ example: 80.4, description: 'Body weight the estimate was based on' })
  basedOnWeightKg!: number;

  @ApiProperty({ description: 'True when no weight is recorded and a default was used' })
  usedFallbackWeight!: boolean;
}
