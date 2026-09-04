import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodUnit } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const SUPPORTED_LOCALES = ['en', 'ru', 'uk'] as const;

export class ParseFoodDto {
  @ApiProperty({ example: 'chicken breast 200 g with rice 150 g' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  text!: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: 'en' })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;
}

export class ParsedFoodDto {
  @ApiProperty()
  foodId!: string;

  @ApiProperty({ example: 'Chicken breast' })
  name!: string;

  @ApiProperty({ example: 200 })
  amount!: number;

  @ApiProperty({ enum: FoodUnit })
  unit!: FoodUnit;

  @ApiProperty({ example: 330 })
  energyKcal!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  proteinG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  carbsG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  fatG!: number | null;

  @ApiProperty({ description: 'True when the answer came from a previously saved result' })
  fromCache!: boolean;
}
