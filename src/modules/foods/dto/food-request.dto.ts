import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FoodUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

const MAX_SERVING_SIZE = 10_000;
const MAX_ENERGY_KCAL = 10_000;
const MAX_MACRO_GRAMS = 1000;

export class CreateFoodDto {
  @ApiProperty({ example: 'Chicken breast' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Local butcher' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brand?: string | null;

  @ApiProperty({ example: 100, description: 'Amount the nutrition values refer to' })
  @IsNumber()
  @Min(0.01)
  @Max(MAX_SERVING_SIZE)
  servingSize!: number;

  @ApiProperty({ enum: FoodUnit, default: FoodUnit.GRAM })
  @IsEnum(FoodUnit)
  servingUnit!: FoodUnit;

  @ApiProperty({ example: 165 })
  @IsNumber()
  @Min(0)
  @Max(MAX_ENERGY_KCAL)
  energyKcal!: number;

  @ApiPropertyOptional({ example: 31 })
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

  @ApiPropertyOptional({ example: 3.6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  fatG?: number | null;
}

export class UpdateFoodDto extends PartialType(CreateFoodDto) {}

export class FoodQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'chicken' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

export class RecentFoodsQueryDto {
  @ApiPropertyOptional({ default: 8, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit = 8;
}
