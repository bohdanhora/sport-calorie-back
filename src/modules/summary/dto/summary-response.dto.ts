import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityCategory, CalorieTargetSource, MealType } from '@prisma/client';

import { ActivityEntryDto } from '../../activities/dto/activity-entry-response.dto';
import { FoodEntryDto } from '../../food-entries/dto/food-entry-response.dto';
import { WeightEntryDto } from '../../weight/dto/weight.dto';

export class CalorieSummaryDto {
  @ApiProperty({ example: 2000 })
  targetKcal!: number;

  @ApiProperty({ example: 1650 })
  consumedKcal!: number;

  @ApiProperty({ example: 420 })
  activityKcal!: number;

  @ApiProperty({ example: 1230, description: 'Consumed minus activity' })
  netKcal!: number;

  @ApiProperty({ example: 770, description: 'Target plus activity minus consumed' })
  remainingKcal!: number;

  @ApiProperty({ example: -770, description: 'Positive is a surplus, negative is a deficit' })
  balanceKcal!: number;

  @ApiProperty({ example: 0.825 })
  targetProgress!: number;

  @ApiProperty({ enum: CalorieTargetSource })
  targetSource!: CalorieTargetSource;
}

export class MacroAmountDto {
  @ApiProperty({ example: 120 })
  proteinG!: number;

  @ApiProperty({ example: 160 })
  carbsG!: number;

  @ApiProperty({ example: 60 })
  fatG!: number;
}

export class MacroSummaryDto {
  @ApiProperty({ type: MacroAmountDto })
  consumed!: MacroAmountDto;

  @ApiProperty({ type: MacroAmountDto })
  target!: MacroAmountDto;
}

export class MealSummaryDto {
  @ApiProperty({ enum: MealType })
  meal!: MealType;

  @ApiProperty({ example: 520 })
  energyKcal!: number;

  @ApiProperty({ type: [FoodEntryDto] })
  entries!: FoodEntryDto[];
}

export class WalkingSummaryDto {
  @ApiProperty({ example: 2 })
  sessions!: number;

  @ApiProperty({ example: 6100 })
  distanceM!: number;

  @ApiProperty({ example: 4500 })
  durationSec!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 4.88 })
  avgSpeedKmh!: number | null;

  @ApiProperty({ example: 341 })
  energyKcal!: number;
}

export class DailySummaryDto {
  @ApiProperty({ example: '2026-03-02' })
  date!: string;

  @ApiProperty({ type: CalorieSummaryDto })
  calories!: CalorieSummaryDto;

  @ApiProperty({ type: MacroSummaryDto })
  macros!: MacroSummaryDto;

  @ApiProperty({ type: [MealSummaryDto] })
  meals!: MealSummaryDto[];

  @ApiProperty({ type: WalkingSummaryDto })
  walking!: WalkingSummaryDto;

  @ApiProperty({ type: [ActivityEntryDto] })
  activities!: ActivityEntryDto[];

  @ApiPropertyOptional({ type: WeightEntryDto, nullable: true })
  weight!: WeightEntryDto | null;
}

export class DayOverviewDto {
  @ApiProperty({ example: '2026-03-02' })
  date!: string;

  @ApiProperty({ example: 1650 })
  consumedKcal!: number;

  @ApiProperty({ example: 420 })
  activityKcal!: number;

  @ApiProperty({ example: 2000 })
  targetKcal!: number;

  @ApiProperty({ example: 1230 })
  netKcal!: number;

  @ApiProperty({ example: 6100 })
  walkingDistanceM!: number;

  @ApiProperty({ example: 4500 })
  walkingDurationSec!: number;

  @ApiProperty({ example: 3 })
  activityCount!: number;

  @ApiProperty({ example: 5 })
  foodEntryCount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 80.4 })
  weightKg!: number | null;
}

export class ProgressAveragesDto {
  @ApiProperty({ example: 21, description: 'Days in the range with at least one entry' })
  daysLogged!: number;

  @ApiProperty({ example: 1840 })
  avgConsumedKcal!: number;

  @ApiProperty({ example: 380 })
  avgActivityKcal!: number;

  @ApiProperty({ example: 1460 })
  avgNetKcal!: number;

  @ApiProperty({ example: -240 })
  avgBalanceKcal!: number;

  @ApiProperty({ example: 4200 })
  avgWalkingDistanceM!: number;

  @ApiProperty({ example: 88200 })
  totalWalkingDistanceM!: number;

  @ApiProperty({ example: 7980 })
  totalActivityKcal!: number;
}

export class ActivityBreakdownDto {
  @ApiProperty()
  activityTypeId!: string;

  @ApiProperty({ example: 'treadmill' })
  slug!: string;

  @ApiProperty({ example: 'Treadmill' })
  name!: string;

  @ApiProperty({ enum: ActivityCategory })
  category!: ActivityCategory;

  @ApiProperty({ example: 12 })
  sessions!: number;

  @ApiProperty({ example: 32400 })
  durationSec!: number;

  @ApiProperty({ example: 2530 })
  energyKcal!: number;
}

export class WeightPointDto {
  @ApiProperty({ example: '2026-03-02' })
  date!: string;

  @ApiProperty({ example: 80.4 })
  weightKg!: number;
}

export class DateRangeDto {
  @ApiProperty({ example: '2026-02-04' })
  from!: string;

  @ApiProperty({ example: '2026-03-02' })
  to!: string;
}

export class ProgressDto {
  @ApiProperty({ type: DateRangeDto })
  range!: DateRangeDto;

  @ApiProperty({ type: [DayOverviewDto] })
  days!: DayOverviewDto[];

  @ApiProperty({ type: [WeightPointDto] })
  weights!: WeightPointDto[];

  @ApiProperty({ type: ProgressAveragesDto })
  averages!: ProgressAveragesDto;

  @ApiProperty({ type: [ActivityBreakdownDto] })
  activityBreakdown!: ActivityBreakdownDto[];
}
