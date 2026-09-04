import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { DateRangeQueryDto } from '../../../common/dto/date-query.dto';

const MIN_WEIGHT_KG = 25;
const MAX_WEIGHT_KG = 400;

export class UpsertWeightDto {
  @ApiProperty({ example: 80.4, minimum: MIN_WEIGHT_KG, maximum: MAX_WEIGHT_KG })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(MIN_WEIGHT_KG)
  @Max(MAX_WEIGHT_KG)
  weightKg!: number;

  @ApiPropertyOptional({ example: 'morning, before breakfast' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string | null;
}

export class WeightHistoryQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({ default: 180, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 180;
}

export class WeightEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: '2026-03-02' })
  date!: string;

  @ApiProperty({ example: 80.4 })
  weightKg!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  note!: string | null;
}

export class WeightSummaryDto {
  @ApiPropertyOptional({ type: Number, nullable: true, example: 80.4 })
  currentWeightKg!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 82.4 })
  startingWeightKg!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 75 })
  targetWeightKg!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: -2 })
  totalChangeKg!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: -0.4 })
  trendKgPerWeek!: number | null;

  @ApiProperty({ type: [WeightEntryDto] })
  entries!: WeightEntryDto[];
}
