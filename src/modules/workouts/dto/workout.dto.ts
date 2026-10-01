import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { SavedExerciseDto } from './saved-exercise.dto';

const MAX_WORKOUT_EXERCISES = 30;

export class CreateWorkoutDto {
  @ApiProperty({ example: 'Workout A' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;

  @ApiProperty({ type: [String], description: 'Saved exercises in the order they are done' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_WORKOUT_EXERCISES)
  @IsUUID('all', { each: true })
  exerciseIds!: string[];
}

export class UpdateWorkoutDto extends PartialType(CreateWorkoutDto) {}

export class WorkoutDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Workout A' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: [SavedExerciseDto] })
  exercises!: SavedExerciseDto[];

  @ApiProperty({ example: 420, description: 'Total calories of the exercises' })
  energyKcal!: number;

  @ApiProperty({ example: 3600, description: 'Total effective duration of the exercises' })
  durationSec!: number;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  lastUsedAt!: string | null;
}
