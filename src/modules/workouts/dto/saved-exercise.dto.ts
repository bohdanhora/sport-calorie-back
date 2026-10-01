import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { EnergySource, Intensity } from '@prisma/client';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';
import { CreateActivityEntryDto } from '../../activities/dto/activity-entry-request.dto';
import { ActivityTypeDto } from '../../activities/dto/activity-type-response.dto';

export class CreateSavedExerciseDto extends OmitType(CreateActivityEntryDto, [
  'title',
  'date',
  'performedAt',
] as const) {
  @ApiProperty({ example: 'Morning WalkingPad' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class UpdateSavedExerciseDto extends PartialType(CreateSavedExerciseDto) {}

export class LogTemplateDto {
  @ApiPropertyOptional({ example: '2026-03-02', description: 'Day to log on, today by default' })
  @IsOptional()
  @IsLocalDate()
  date?: string;
}

export class SavedExerciseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Morning WalkingPad' })
  name!: string;

  @ApiProperty({ type: ActivityTypeDto })
  activityType!: ActivityTypeDto;

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

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({
    example: 211,
    description:
      'The stored value when one was entered, otherwise an estimate at the current weight',
  })
  energyKcal!: number;

  @ApiProperty({ enum: EnergySource })
  energySource!: EnergySource;

  @ApiProperty({ example: 2700 })
  effectiveDurationSec!: number;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  lastUsedAt!: string | null;
}
