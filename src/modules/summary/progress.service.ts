import { Injectable } from '@nestjs/common';
import { ActivityCategory } from '@prisma/client';

import {
  addLocalDays,
  enumerateLocalDates,
  parseLocalDate,
  toLocalDateString,
  todayInTimeZone,
  type LocalDateString,
} from '../../common/date/local-date';
import { round } from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetsService } from '../targets/targets.service';
import { UserContextService } from '../user-context/user-context.service';
import type {
  ActivityBreakdownDto,
  DayOverviewDto,
  ProgressAveragesDto,
  ProgressDto,
} from './dto/summary-response.dto';

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;

export interface ResolvedRange {
  from: LocalDateString;
  to: LocalDateString;
}

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targetsService: TargetsService,
    private readonly userContext: UserContextService,
  ) {}

  async resolveRange(userId: string, from?: string, to?: string): Promise<ResolvedRange> {
    const timezone = await this.userContext.getTimezone(userId);
    const resolvedTo = to ?? todayInTimeZone(timezone);
    const resolvedFrom = from ?? addLocalDays(resolvedTo, -(DEFAULT_RANGE_DAYS - 1));

    return { from: resolvedFrom, to: resolvedTo };
  }

  async getDayOverviews(userId: string, range: ResolvedRange): Promise<DayOverviewDto[]> {
    const context = await this.userContext.getContext(userId);
    const dateFilter = { gte: parseLocalDate(range.from), lte: parseLocalDate(range.to) };

    const [food, activity, walking, weights, targets] = await Promise.all([
      this.prisma.foodEntry.groupBy({
        by: ['localDate'],
        where: { userId, localDate: dateFilter },
        _sum: { energyKcal: true },
        _count: { _all: true },
      }),
      this.prisma.activityEntry.groupBy({
        by: ['localDate'],
        where: { userId, localDate: dateFilter },
        _sum: { energyKcal: true },
        _count: { _all: true },
      }),
      this.prisma.activityEntry.groupBy({
        by: ['localDate'],
        where: {
          userId,
          localDate: dateFilter,
          activityType: { category: ActivityCategory.WALKING },
        },
        _sum: { distanceM: true, durationSec: true },
      }),
      this.prisma.weightEntry.findMany({
        where: { userId, date: dateFilter },
        select: { date: true, weightKg: true },
      }),
      this.targetsService.resolveRange(userId, range.from, range.to, context),
    ]);

    const foodByDate = new Map(food.map((row) => [toLocalDateString(row.localDate), row]));
    const activityByDate = new Map(activity.map((row) => [toLocalDateString(row.localDate), row]));
    const walkingByDate = new Map(walking.map((row) => [toLocalDateString(row.localDate), row]));
    const weightByDate = new Map(weights.map((row) => [toLocalDateString(row.date), row.weightKg]));

    return enumerateLocalDates(range.from, range.to).map((date) => {
      const consumedKcal = round(foodByDate.get(date)?._sum.energyKcal ?? 0);
      const activityKcal = round(activityByDate.get(date)?._sum.energyKcal ?? 0);

      return {
        date,
        consumedKcal,
        activityKcal,
        targetKcal: targets.get(date)?.calorieTargetKcal ?? 0,
        netKcal: round(consumedKcal - activityKcal),
        walkingDistanceM: round(walkingByDate.get(date)?._sum.distanceM ?? 0),
        walkingDurationSec: walkingByDate.get(date)?._sum.durationSec ?? 0,
        activityCount: activityByDate.get(date)?._count._all ?? 0,
        foodEntryCount: foodByDate.get(date)?._count._all ?? 0,
        weightKg: weightByDate.get(date) ?? null,
      };
    });
  }

  async getProgress(userId: string, from?: string, to?: string): Promise<ProgressDto> {
    const range = await this.resolveRange(userId, from, to);
    const [days, activityBreakdown] = await Promise.all([
      this.getDayOverviews(userId, range),
      this.getActivityBreakdown(userId, range),
    ]);

    return {
      range,
      days,
      weights: days
        .filter((day) => day.weightKg !== null)
        .map((day) => ({ date: day.date, weightKg: day.weightKg as number })),
      averages: this.calculateAverages(days),
      activityBreakdown,
    };
  }

  private async getActivityBreakdown(
    userId: string,
    range: ResolvedRange,
  ): Promise<ActivityBreakdownDto[]> {
    const grouped = await this.prisma.activityEntry.groupBy({
      by: ['activityTypeId'],
      where: {
        userId,
        localDate: { gte: parseLocalDate(range.from), lte: parseLocalDate(range.to) },
      },
      _sum: { energyKcal: true, durationSec: true },
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return [];
    }

    const types = await this.prisma.activityType.findMany({
      where: { id: { in: grouped.map((row) => row.activityTypeId) } },
      select: { id: true, slug: true, name: true, category: true },
    });
    const typeById = new Map(types.map((type) => [type.id, type]));

    return grouped
      .map((row) => {
        const type = typeById.get(row.activityTypeId);

        return {
          activityTypeId: row.activityTypeId,
          slug: type?.slug ?? 'other',
          name: type?.name ?? 'Unknown',
          category: type?.category ?? ActivityCategory.OTHER,
          sessions: row._count._all,
          durationSec: row._sum.durationSec ?? 0,
          energyKcal: round(row._sum.energyKcal ?? 0),
        };
      })
      .sort((left, right) => right.energyKcal - left.energyKcal);
  }

  private calculateAverages(days: DayOverviewDto[]): ProgressAveragesDto {
    const loggedDays = days.filter(
      (day) => day.foodEntryCount > 0 || day.activityCount > 0 || day.weightKg !== null,
    );
    const divisor = loggedDays.length || 1;

    const total = loggedDays.reduce(
      (accumulator, day) => ({
        consumedKcal: accumulator.consumedKcal + day.consumedKcal,
        activityKcal: accumulator.activityKcal + day.activityKcal,
        netKcal: accumulator.netKcal + day.netKcal,
        balanceKcal: accumulator.balanceKcal + (day.netKcal - day.targetKcal),
        walkingDistanceM: accumulator.walkingDistanceM + day.walkingDistanceM,
      }),
      { consumedKcal: 0, activityKcal: 0, netKcal: 0, balanceKcal: 0, walkingDistanceM: 0 },
    );

    return {
      daysLogged: loggedDays.length,
      avgConsumedKcal: round(total.consumedKcal / divisor),
      avgActivityKcal: round(total.activityKcal / divisor),
      avgNetKcal: round(total.netKcal / divisor),
      avgBalanceKcal: round(total.balanceKcal / divisor),
      avgWalkingDistanceM: round(total.walkingDistanceM / divisor),
      totalWalkingDistanceM: round(days.reduce((sum, day) => sum + day.walkingDistanceM, 0)),
      totalActivityKcal: round(days.reduce((sum, day) => sum + day.activityKcal, 0)),
    };
  }
}
