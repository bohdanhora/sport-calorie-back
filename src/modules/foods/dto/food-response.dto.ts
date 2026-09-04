import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodSource, FoodUnit } from '@prisma/client';

import { PaginationMetaDto } from '../../../common/dto/pagination.dto';

export class FoodDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'Chicken breast' })
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  brand!: string | null;

  @ApiProperty({ example: 100 })
  servingSize!: number;

  @ApiProperty({ enum: FoodUnit })
  servingUnit!: FoodUnit;

  @ApiProperty({ example: 165 })
  energyKcal!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  proteinG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  carbsG!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  fatG!: number | null;

  @ApiProperty({ enum: FoodSource })
  source!: FoodSource;

  @ApiProperty({ description: 'False for shared catalog foods, which cannot be edited' })
  isOwned!: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  lastUsedAt!: string | null;

  @ApiProperty({ example: 0 })
  usageCount!: number;
}

export class PaginatedFoodsDto {
  @ApiProperty({ type: [FoodDto] })
  items!: FoodDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
