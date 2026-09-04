import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

const MIN_CALORIE_TARGET = 800;
const MAX_CALORIE_TARGET = 8000;
const MAX_MACRO_GRAMS = 1000;

export class SetDailyTargetDto {
  @ApiProperty({ example: 2000, minimum: MIN_CALORIE_TARGET, maximum: MAX_CALORIE_TARGET })
  @IsNumber()
  @Min(MIN_CALORIE_TARGET)
  @Max(MAX_CALORIE_TARGET)
  calorieTargetKcal!: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  proteinTargetG?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  carbsTargetG?: number;

  @ApiPropertyOptional({ example: 65 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  fatTargetG?: number;
}
