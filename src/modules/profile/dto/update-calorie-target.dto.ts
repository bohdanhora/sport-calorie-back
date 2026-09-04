import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

const MIN_CALORIE_TARGET = 800;
const MAX_CALORIE_TARGET = 8000;
const MAX_MACRO_GRAMS = 1000;

export class UpdateCalorieTargetDto {
  @ApiPropertyOptional({
    example: 2100,
    nullable: true,
    description: 'Null restores the recommended target derived from BMR and TDEE',
  })
  @IsOptional()
  @IsNumber()
  @Min(MIN_CALORIE_TARGET)
  @Max(MAX_CALORIE_TARGET)
  calorieTargetKcal?: number | null;

  @ApiPropertyOptional({ example: 150, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  proteinTargetG?: number | null;

  @ApiPropertyOptional({ example: 200, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  carbsTargetG?: number | null;

  @ApiPropertyOptional({ example: 65, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(MAX_MACRO_GRAMS)
  fatTargetG?: number | null;
}
