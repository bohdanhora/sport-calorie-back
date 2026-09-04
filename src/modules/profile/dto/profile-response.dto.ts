import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLevel, BiologicalSex, FitnessGoal, UnitSystem } from '@prisma/client';

import { EnergyProfileDto } from '../../targets/dto/target-response.dto';

export class ProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'me@example.com' })
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ enum: BiologicalSex, nullable: true })
  sex!: BiologicalSex | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '1994-06-15' })
  birthDate!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 180 })
  heightCm!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 75 })
  targetWeightKg!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 80.4 })
  currentWeightKg!: number | null;

  @ApiProperty({ enum: ActivityLevel })
  activityLevel!: ActivityLevel;

  @ApiProperty({ enum: FitnessGoal })
  goal!: FitnessGoal;

  @ApiProperty({ enum: UnitSystem })
  unitSystem!: UnitSystem;

  @ApiProperty({ example: 'Europe/Kyiv' })
  timezone!: string;

  @ApiProperty({ example: 'en' })
  locale!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2100 })
  manualCalorieTargetKcal!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  manualProteinTargetG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  manualCarbsTargetG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  manualFatTargetG!: number | null;

  @ApiProperty({ type: EnergyProfileDto })
  energy!: EnergyProfileDto;
}
