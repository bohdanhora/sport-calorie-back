import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodUnit, MealType } from '@prisma/client';

export class FoodEntryDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  foodId!: string | null;

  @ApiProperty({ example: 'Chicken breast' })
  name!: string;

  @ApiProperty({ enum: MealType })
  meal!: MealType;

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

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ format: 'date-time' })
  consumedAt!: string;

  @ApiProperty({ example: '2026-03-02' })
  date!: string;
}
