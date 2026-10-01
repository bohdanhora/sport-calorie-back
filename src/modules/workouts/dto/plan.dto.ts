import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';
import { CreateActivityEntryDto } from '../../activities/dto/activity-entry-request.dto';
import { ActivityEntryDto } from '../../activities/dto/activity-entry-response.dto';
import { SavedExerciseDto } from './saved-exercise.dto';

const MAX_PLANS_PER_DAY = 100;

export const PLAN_KINDS = ['WORKOUT', 'EXERCISE', 'ACTIVITY'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

class PlanActivityFieldsDto extends OmitType(CreateActivityEntryDto, [
  'activityTypeId',
  'title',
  'date',
  'performedAt',
] as const) {}

export class CreatePlanDto extends PlanActivityFieldsDto {
  @ApiProperty({ example: '2026-03-02' })
  @IsLocalDate()
  date!: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Place within the day, the end of the day when left out',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PLANS_PER_DAY)
  position?: number;

  @ApiPropertyOptional({ description: 'Plan a saved workout' })
  @IsOptional()
  @IsUUID()
  workoutId?: string;

  @ApiPropertyOptional({ description: 'Plan a saved exercise' })
  @IsOptional()
  @IsUUID()
  exerciseId?: string;

  @ApiPropertyOptional({ description: 'Plan a one-off activity with the measurements given' })
  @IsOptional()
  @IsUUID()
  activityTypeId?: string;

  @ApiPropertyOptional({ example: 'Treadmill' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;
}

export class UpdatePlanDto extends PartialType(
  OmitType(CreatePlanDto, ['workoutId', 'exerciseId'] as const),
) {}

export class PlanDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '2026-03-02' })
  date!: string;

  @ApiProperty({ example: 0 })
  position!: number;

  @ApiProperty({ enum: PLAN_KINDS })
  kind!: PlanKind;

  @ApiProperty({ example: 'Workout A' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  workoutId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  exerciseId!: string | null;

  @ApiProperty({
    type: [SavedExerciseDto],
    description: 'What the plan is made of; a one-off activity appears as a single item',
  })
  exercises!: SavedExerciseDto[];

  @ApiProperty({ example: 420, description: 'Logged calories once done, the estimate before' })
  energyKcal!: number;

  @ApiProperty({ example: 3600 })
  durationSec!: number;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  completedAt!: string | null;

  @ApiProperty({ type: [ActivityEntryDto] })
  entries!: ActivityEntryDto[];
}

export class CalendarDto {
  @ApiProperty({ type: [PlanDto] })
  plans!: PlanDto[];

  @ApiProperty({
    type: [ActivityEntryDto],
    description: 'Activities logged in the range that did not come from a plan',
  })
  activities!: ActivityEntryDto[];
}
