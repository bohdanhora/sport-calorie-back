import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityLevel, BiologicalSex, FitnessGoal, UnitSystem } from '@prisma/client';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';
import { IsTimeZone } from '../../../common/validation/is-time-zone.validator';
import { SUPPORTED_LOCALES } from '../../nutrition-provider/dto/parse-food.dto';

const MIN_HEIGHT_CM = 80;
const MAX_HEIGHT_CM = 260;
const MIN_WEIGHT_KG = 25;
const MAX_WEIGHT_KG = 400;

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Bohdan' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @ApiPropertyOptional({ enum: BiologicalSex })
  @IsOptional()
  @IsEnum(BiologicalSex)
  sex?: BiologicalSex | null;

  @ApiPropertyOptional({ example: '1994-06-15' })
  @IsOptional()
  @IsLocalDate()
  birthDate?: string | null;

  @ApiPropertyOptional({ example: 180, minimum: MIN_HEIGHT_CM, maximum: MAX_HEIGHT_CM })
  @IsOptional()
  @IsNumber()
  @Min(MIN_HEIGHT_CM)
  @Max(MAX_HEIGHT_CM)
  heightCm?: number | null;

  @ApiPropertyOptional({ example: 75, minimum: MIN_WEIGHT_KG, maximum: MAX_WEIGHT_KG })
  @IsOptional()
  @IsNumber()
  @Min(MIN_WEIGHT_KG)
  @Max(MAX_WEIGHT_KG)
  targetWeightKg?: number | null;

  @ApiPropertyOptional({ enum: ActivityLevel })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({ enum: FitnessGoal })
  @IsOptional()
  @IsEnum(FitnessGoal)
  goal?: FitnessGoal;

  @ApiPropertyOptional({ enum: UnitSystem })
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
}
