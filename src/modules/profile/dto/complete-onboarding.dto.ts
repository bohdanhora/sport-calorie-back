import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLevel, BiologicalSex, FitnessGoal, UnitSystem } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';
import { IsTimeZone } from '../../../common/validation/is-time-zone.validator';
import { SUPPORTED_LOCALES } from '../../nutrition-provider/dto/parse-food.dto';

const MIN_HEIGHT_CM = 80;
const MAX_HEIGHT_CM = 260;
const MIN_WEIGHT_KG = 25;
const MAX_WEIGHT_KG = 400;
const MIN_CALORIE_TARGET = 800;
const MAX_CALORIE_TARGET = 8000;

export class CompleteOnboardingDto {
  @ApiPropertyOptional({ example: 'Bohdan' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @ApiProperty({ enum: BiologicalSex })
  @IsEnum(BiologicalSex)
  sex!: BiologicalSex;

  @ApiProperty({ example: '1994-06-15' })
  @IsLocalDate()
  birthDate!: string;

  @ApiProperty({ example: 180, minimum: MIN_HEIGHT_CM, maximum: MAX_HEIGHT_CM })
  @IsNumber()
  @Min(MIN_HEIGHT_CM)
  @Max(MAX_HEIGHT_CM)
  heightCm!: number;

  @ApiProperty({ example: 80.4, minimum: MIN_WEIGHT_KG, maximum: MAX_WEIGHT_KG })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_WEIGHT_KG)
  @Max(MAX_WEIGHT_KG)
  currentWeightKg!: number;

  @ApiPropertyOptional({ example: 75, minimum: MIN_WEIGHT_KG, maximum: MAX_WEIGHT_KG })
  @IsOptional()
  @IsNumber()
  @Min(MIN_WEIGHT_KG)
  @Max(MAX_WEIGHT_KG)
  targetWeightKg?: number | null;

  @ApiProperty({ enum: ActivityLevel })
  @IsEnum(ActivityLevel)
  activityLevel!: ActivityLevel;

  @ApiProperty({ enum: FitnessGoal })
  @IsEnum(FitnessGoal)
  goal!: FitnessGoal;

  @ApiPropertyOptional({ enum: UnitSystem, default: UnitSystem.METRIC })
  @IsOptional()
  @IsEnum(UnitSystem)
  unitSystem?: UnitSystem;

  @ApiPropertyOptional({ example: 'Europe/Kyiv' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @ApiPropertyOptional({
    example: 2100,
    nullable: true,
    description: 'A manual daily target; null keeps the one recommended from BMR and TDEE',
  })
  @IsOptional()
  @IsNumber()
  @Min(MIN_CALORIE_TARGET)
  @Max(MAX_CALORIE_TARGET)
  calorieTargetKcal?: number | null;
}
