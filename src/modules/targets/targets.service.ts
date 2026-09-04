import { Injectable } from '@nestjs/common';
import { CalorieTargetSource, type DailyGoal, type UserProfile } from '@prisma/client';

import {
  enumerateLocalDates,
  parseLocalDate,
  toLocalDateString,
  todayInTimeZone,
  type LocalDateString,
} from '../../common/date/local-date';
import {
  ACTIVITY_FACTORS,
  DEFAULT_CALORIE_TARGET_KCAL,
  GOAL_ADJUSTMENTS,
  calculateAgeYears,
  calculateBmr,
  calculateMacroTargets,
  calculateRecommendedCalorieTarget,
  calculateTdee,
} from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService, type UserContext } from '../user-context/user-context.service';

export type MissingProfileField = 'sex' | 'birthDate' | 'heightCm' | 'weightKg';

export interface EnergyProfile {
  isComplete: boolean;
  missingFields: MissingProfileField[];
  bmrKcal: number | null;
  tdeeKcal: number | null;
  recommendedCalorieTargetKcal: number | null;
  activityFactor: number;
  goalAdjustment: number;
}

export interface ResolvedDailyTarget {
  date: LocalDateString;
  calorieTargetKcal: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  source: CalorieTargetSource;
  isDayOverride: boolean;
}

export interface DailyTargetInput {
  calorieTargetKcal: number;
  proteinTargetG?: number | null;
  carbsTargetG?: number | null;
  fatTargetG?: number | null;
}

@Injectable()
export class TargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
  ) {}

  calculateEnergyProfile(
    profile: UserProfile,
    weightKg: number | null,
    now = new Date(),
  ): EnergyProfile {
    const { sex, birthDate, heightCm } = profile;

    const missingFields: MissingProfileField[] = [];

    if (!sex) {
      missingFields.push('sex');
    }
    if (!birthDate) {
      missingFields.push('birthDate');
    }
    if (!heightCm) {
      missingFields.push('heightCm');
    }
    if (!weightKg) {
      missingFields.push('weightKg');
    }

    const activityFactor = ACTIVITY_FACTORS[profile.activityLevel];
    const goalAdjustment = GOAL_ADJUSTMENTS[profile.goal];

    if (!sex || !birthDate || !heightCm || !weightKg) {
      return {
        isComplete: false,
        missingFields,
        bmrKcal: null,
        tdeeKcal: null,
        recommendedCalorieTargetKcal: null,
        activityFactor,
        goalAdjustment,
      };
    }

    const bmrKcal = calculateBmr({
      sex,
      weightKg,
      heightCm,
      ageYears: calculateAgeYears(birthDate, now),
    });
    const tdeeKcal = calculateTdee(bmrKcal, profile.activityLevel);

    return {
      isComplete: true,
      missingFields,
      bmrKcal,
      tdeeKcal,
      recommendedCalorieTargetKcal: calculateRecommendedCalorieTarget(
        tdeeKcal,
        profile.goal,
        bmrKcal,
      ),
      activityFactor,
      goalAdjustment,
    };
  }

  async getEnergyProfile(userId: string): Promise<EnergyProfile> {
    const context = await this.userContext.getContext(userId);
    return this.calculateEnergyProfile(context.profile, context.latestWeightKg);
  }

  async resolveDailyTarget(
    userId: string,
    date: LocalDateString,
    context?: UserContext,
  ): Promise<ResolvedDailyTarget> {
    const resolvedContext = context ?? (await this.userContext.getContext(userId));
    const [override, weightKg] = await Promise.all([
      this.prisma.dailyGoal.findUnique({
        where: { userId_date: { userId, date: parseLocalDate(date) } },
      }),
      this.userContext.getWeightOnOrBefore(userId, date),
    ]);

    const { profile } = resolvedContext;

    return override
      ? this.buildOverrideTarget(date, override, weightKg)
      : this.buildProfileTarget(date, profile, weightKg);
  }

  async resolveRange(
    userId: string,
    from: LocalDateString,
    to: LocalDateString,
    context?: UserContext,
  ): Promise<Map<LocalDateString, ResolvedDailyTarget>> {
    const resolvedContext = context ?? (await this.userContext.getContext(userId));
    const overrides = await this.prisma.dailyGoal.findMany({
      where: { userId, date: { gte: parseLocalDate(from), lte: parseLocalDate(to) } },
    });

    const weightKg = resolvedContext.latestWeightKg;
    const targets = new Map<LocalDateString, ResolvedDailyTarget>();

    enumerateLocalDates(from, to).forEach((date) => {
      targets.set(date, this.buildProfileTarget(date, resolvedContext.profile, weightKg));
    });

    overrides.forEach((override) => {
      const date = toLocalDateString(override.date);

      targets.set(date, this.buildOverrideTarget(date, override, weightKg));
    });

    return targets;
  }

  private buildOverrideTarget(
    date: LocalDateString,
    override: DailyGoal,
    weightKg: number | null,
  ): ResolvedDailyTarget {
    const macros = calculateMacroTargets(override.calorieTargetKcal, weightKg);

    return {
      date,
      calorieTargetKcal: override.calorieTargetKcal,
      proteinTargetG: override.proteinTargetG ?? macros.proteinG,
      carbsTargetG: override.carbsTargetG ?? macros.carbsG,
      fatTargetG: override.fatTargetG ?? macros.fatG,
      source: override.source,
      isDayOverride: true,
    };
  }

  private buildProfileTarget(
    date: LocalDateString,
    profile: UserProfile,
    weightKg: number | null,
  ): ResolvedDailyTarget {
    const energy = this.calculateEnergyProfile(profile, weightKg);
    const calorieTargetKcal =
      profile.manualCalorieTargetKcal ??
      energy.recommendedCalorieTargetKcal ??
      DEFAULT_CALORIE_TARGET_KCAL;

    const macros = calculateMacroTargets(calorieTargetKcal, weightKg);

    return {
      date,
      calorieTargetKcal,
      proteinTargetG: profile.manualProteinTargetG ?? macros.proteinG,
      carbsTargetG: profile.manualCarbsTargetG ?? macros.carbsG,
      fatTargetG: profile.manualFatTargetG ?? macros.fatG,
      source:
        profile.manualCalorieTargetKcal !== null
          ? CalorieTargetSource.MANUAL
          : CalorieTargetSource.RECOMMENDED,
      isDayOverride: false,
    };
  }

  async setDailyTarget(
    userId: string,
    date: LocalDateString,
    input: DailyTargetInput,
  ): Promise<ResolvedDailyTarget> {
    const data = {
      calorieTargetKcal: input.calorieTargetKcal,
      proteinTargetG: input.proteinTargetG ?? null,
      carbsTargetG: input.carbsTargetG ?? null,
      fatTargetG: input.fatTargetG ?? null,
      source: CalorieTargetSource.MANUAL,
    };

    await this.prisma.dailyGoal.upsert({
      where: { userId_date: { userId, date: parseLocalDate(date) } },
      create: { userId, date: parseLocalDate(date), ...data },
      update: data,
    });

    return this.resolveDailyTarget(userId, date);
  }

  async clearDailyTarget(userId: string, date: LocalDateString): Promise<ResolvedDailyTarget> {
    await this.prisma.dailyGoal.deleteMany({
      where: { userId, date: parseLocalDate(date) },
    });

    return this.resolveDailyTarget(userId, date);
  }

  async resolveToday(userId: string): Promise<ResolvedDailyTarget> {
    const context = await this.userContext.getContext(userId);
    return this.resolveDailyTarget(userId, todayInTimeZone(context.timezone), context);
  }
}
