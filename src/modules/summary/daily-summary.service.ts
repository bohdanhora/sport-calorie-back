import { Injectable } from '@nestjs/common';
import { ActivityCategory, MealType, type FoodEntry } from '@prisma/client';

import { parseLocalDate, type LocalDateString } from '../../common/date/local-date';
import { calculateCalorieBalance, round, sumNutrition, summariseWalking } from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { toActivityEntryDto } from '../activities/activity-entries.service';
import { toFoodEntryDto } from '../food-entries/food-entries.service';
import { TargetsService } from '../targets/targets.service';
import { UserContextService } from '../user-context/user-context.service';
import { toWeightEntryDto } from '../weight/weight.service';
import type { DailySummaryDto, MealSummaryDto } from './dto/summary-response.dto';

const MEAL_ORDER: MealType[] = [
  MealType.BREAKFAST,
  MealType.LUNCH,
  MealType.DINNER,
  MealType.SNACK,
];

@Injectable()
export class DailySummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targetsService: TargetsService,
    private readonly userContext: UserContextService,
  ) {}

  async getDay(userId: string, date: LocalDateString): Promise<DailySummaryDto> {
    const localDate = parseLocalDate(date);
    const context = await this.userContext.getContext(userId);

    const [foodEntries, activityEntries, weightEntry, target] = await Promise.all([
      this.prisma.foodEntry.findMany({
        where: { userId, localDate },
        orderBy: [{ consumedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.activityEntry.findMany({
        where: { userId, localDate },
        include: { activityType: true },
        orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.weightEntry.findUnique({ where: { userId_date: { userId, date: localDate } } }),
      this.targetsService.resolveDailyTarget(userId, date, context),
    ]);

    const consumed = sumNutrition(foodEntries);
    const activityKcal = round(
      activityEntries.reduce((total, entry) => total + entry.energyKcal, 0),
    );

    const balance = calculateCalorieBalance({
      targetKcal: target.calorieTargetKcal,
      consumedKcal: consumed.energyKcal,
      activityKcal,
    });

    const walking = summariseWalking(
      activityEntries.filter((entry) => entry.activityType.category === ActivityCategory.WALKING),
    );

    return {
      date,
      calories: { ...balance, targetSource: target.source },
      macros: {
        consumed: {
          proteinG: consumed.proteinG,
          carbsG: consumed.carbsG,
          fatG: consumed.fatG,
        },
        target: {
          proteinG: target.proteinTargetG,
          carbsG: target.carbsTargetG,
          fatG: target.fatTargetG,
        },
      },
      meals: this.groupByMeal(foodEntries),
      walking,
      activities: activityEntries.map((entry) => toActivityEntryDto(entry, userId)),
      weight: weightEntry ? toWeightEntryDto(weightEntry) : null,
    };
  }

  private groupByMeal(entries: FoodEntry[]): MealSummaryDto[] {
    return MEAL_ORDER.map((meal) => {
      const mealEntries = entries.filter((entry) => entry.meal === meal);

      return {
        meal,
        energyKcal: round(mealEntries.reduce((total, entry) => total + entry.energyKcal, 0)),
        entries: mealEntries.map(toFoodEntryDto),
      };
    });
  }
}
