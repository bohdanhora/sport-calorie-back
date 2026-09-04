import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FoodUnit, MealType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { IsLocalDate } from '../../../common/validation/is-local-date.validator';

const MAX_AMOUNT = 10_000;
const MAX_ENERGY_KCAL = 10_000;
const MAX_MACRO_GRAMS = 1000;

export class CreateFoodEntryDto {
  @ApiPropertyOptional({ description: 'Reusable food to copy nutrition from' })
  @IsOptional()
  @IsUUID()
  foodId?: string;

  @ApiPropertyOptional({ example: 'Chicken breast', description: 'Required for a one-off entry' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ enum: MealType })
  @IsEnum(MealType)
  meal!: MealType;

  @ApiProperty({ example: 200 })
  @IsNumber()
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @ApiProperty({ enum: FoodUnit, default: FoodUnit.GRAM })
  @IsEnum(FoodUnit)
  unit!: FoodUnit;

  @ApiPropertyOptional({ example: 330, description: 'Overrides the value derived from the food' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_ENERGY_KCAL)
  energyKcal?: number;

  @ApiPropertyOptional({ example: 62 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  proteinG?: number | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  carbsG?: number | null;

  @ApiPropertyOptional({ example: 7.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  fatG?: number | null;

  @ApiPropertyOptional({ example: 'after training' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string | null;

  @ApiPropertyOptional({
    example: '2026-03-02',
    description: 'Defaults to today in the user timezone',
  })
  @IsOptional()
  @IsLocalDate()
  date?: string;

  @ApiPropertyOptional({ description: 'Exact moment of consumption, overrides date' })
  @IsOptional()
  @IsISO8601()
  consumedAt?: string;
}

export class UpdateFoodEntryDto extends PartialType(CreateFoodEntryDto) {}
