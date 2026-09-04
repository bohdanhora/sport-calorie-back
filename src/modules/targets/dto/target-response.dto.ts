import { ApiProperty } from '@nestjs/swagger';
import { CalorieTargetSource } from '@prisma/client';

export class DailyTargetDto {
  @ApiProperty({ example: '2026-03-02' })
  date!: string;

  @ApiProperty({ example: 2000 })
  calorieTargetKcal!: number;

  @ApiProperty({ example: 144 })
  proteinTargetG!: number;

  @ApiProperty({ example: 212 })
  carbsTargetG!: number;

  @ApiProperty({ example: 64 })
  fatTargetG!: number;

  @ApiProperty({ enum: CalorieTargetSource })
  source!: CalorieTargetSource;

  @ApiProperty({ description: 'True when this day has its own target instead of the profile one' })
  isDayOverride!: boolean;
}

export class EnergyProfileDto {
  @ApiProperty()
  isComplete!: boolean;

  @ApiProperty({ type: [String], example: ['weightKg'] })
  missingFields!: string[];

  @ApiProperty({ nullable: true, type: Number, example: 1780 })
  bmrKcal!: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 2448 })
  tdeeKcal!: number | null;

  @ApiProperty({ nullable: true, type: Number, example: 2081 })
  recommendedCalorieTargetKcal!: number | null;

  @ApiProperty({ example: 1.375 })
  activityFactor!: number;

  @ApiProperty({ example: -0.15 })
  goalAdjustment!: number;
}
