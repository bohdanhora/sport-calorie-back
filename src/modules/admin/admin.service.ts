import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AdminField,
  AdminStats,
  AdminTable,
  AdminUserDetail,
  AdminUserList,
  AdminUserSummary,
} from './admin.contract';
import type { AdminUsersQueryDto } from './dto/admin-users-query.dto';

const DAY_MS = 86_400_000;
const RECENT_ROWS = 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

const daysAgo = (days: number): Date => new Date(Date.now() - days * DAY_MS);

const isoDate = (value: Date | null | undefined): string | null =>
  value ? value.toISOString().slice(0, 10) : null;

const isoDateTime = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const round = (value: number | null | undefined, digits = 1): number | null =>
  value === null || value === undefined ? null : Number(value.toFixed(digits));

const summarySelect = {
  id: true,
  email: true,
  passwordHash: true,
  googleId: true,
  createdAt: true,
  profile: { select: { displayName: true } },
  refreshTokens: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserSelect;

type SummaryRecord = Prisma.UserGetPayload<{ select: typeof summarySelect }>;

const toSummary = (user: SummaryRecord): AdminUserSummary => ({
  id: user.id,
  email: user.email,
  name: user.profile?.displayName ?? null,
  createdAt: user.createdAt.toISOString(),
  lastActiveAt: isoDateTime(user.refreshTokens[0]?.createdAt),
  authMethods: [...(user.passwordHash ? ['password'] : []), ...(user.googleId ? ['google'] : [])],
});

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStats> {
    const weekAgo = daysAgo(7);
    const [
      total,
      new7d,
      new30d,
      active7d,
      onboarded,
      foodEntries,
      foodEntries7d,
      activityEntries,
      activityEntries7d,
      weightEntries,
      workouts,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      this.prisma.user.count({
        where: { refreshTokens: { some: { createdAt: { gte: weekAgo } } } },
      }),
      this.prisma.userProfile.count({ where: { onboardingCompletedAt: { not: null } } }),
      this.prisma.foodEntry.count(),
      this.prisma.foodEntry.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.activityEntry.count(),
      this.prisma.activityEntry.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.weightEntry.count(),
      this.prisma.workout.count(),
    ]);

    return {
      users: { total, new7d, new30d, active7d },
      metrics: [
        { label: 'Onboarded users', value: onboarded, kind: 'number' },
        { label: 'Food entries', value: foodEntries, kind: 'number' },
        { label: 'Food entries, 7 days', value: foodEntries7d, kind: 'number' },
        { label: 'Activity entries', value: activityEntries, kind: 'number' },
        { label: 'Activity entries, 7 days', value: activityEntries7d, kind: 'number' },
        { label: 'Weight entries', value: weightEntries, kind: 'number' },
        { label: 'Routines', value: workouts, kind: 'number' },
      ],
    };
  }

  async listUsers(query: AdminUsersQueryDto): Promise<AdminUserList> {
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { profile: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ...(isUuid(query.search) ? [{ id: query.search }] : []),
          ],
        }
      : {};

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: summarySelect,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      items: users.map(toSummary),
      meta: buildPaginationMeta(total, query.limit, query.offset),
    };
  }

  async getUser(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { ...summarySelect, updatedAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const [
      profile,
      sessions,
      counts,
      foodEntries,
      activityEntries,
      weightEntries,
      dailyGoals,
      workouts,
      plannedSessions,
      foods,
    ] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId: id } }),
      this.prisma.refreshToken.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ROWS,
        select: { createdAt: true, expiresAt: true, revokedAt: true, rotatedAt: true },
      }),
      this.countRecords(id),
      this.prisma.foodEntry.findMany({
        where: { userId: id },
        orderBy: { consumedAt: 'desc' },
        take: RECENT_ROWS,
      }),
      this.prisma.activityEntry.findMany({
        where: { userId: id },
        orderBy: { performedAt: 'desc' },
        take: RECENT_ROWS,
        include: { activityType: { select: { name: true } } },
      }),
      this.prisma.weightEntry.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: RECENT_ROWS,
      }),
      this.prisma.dailyGoal.findMany({
        where: { userId: id },
        orderBy: { date: 'desc' },
        take: RECENT_ROWS,
      }),
      this.prisma.workout.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ROWS,
        include: { _count: { select: { exercises: true, plans: true } } },
      }),
      this.prisma.plannedSession.findMany({
        where: { userId: id },
        orderBy: [{ localDate: 'desc' }, { position: 'asc' }],
        take: RECENT_ROWS,
        include: {
          workout: { select: { name: true } },
          exercise: { select: { name: true } },
          activityType: { select: { name: true } },
        },
      }),
      this.prisma.food.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: RECENT_ROWS,
      }),
    ]);

    const activeSessions = sessions.filter(
      (session) => !session.revokedAt && !session.rotatedAt && session.expiresAt > now,
    ).length;

    const account: AdminField[] = [
      { label: 'ID', value: user.id },
      { label: 'Email', value: user.email, kind: 'email' },
      { label: 'Password sign-in', value: Boolean(user.passwordHash), kind: 'boolean' },
      { label: 'Google sign-in', value: Boolean(user.googleId), kind: 'boolean' },
      { label: 'Registered', value: user.createdAt.toISOString(), kind: 'datetime' },
      { label: 'Updated', value: user.updatedAt.toISOString(), kind: 'datetime' },
      {
        label: 'Last session',
        value: isoDateTime(user.refreshTokens[0]?.createdAt),
        kind: 'datetime',
      },
      { label: 'Active sessions', value: activeSessions, kind: 'number' },
    ];

    const profileFields: AdminField[] = profile
      ? [
          { label: 'Display name', value: profile.displayName },
          { label: 'Sex', value: profile.sex },
          { label: 'Birth date', value: isoDate(profile.birthDate), kind: 'date' },
          { label: 'Height, cm', value: round(profile.heightCm), kind: 'number' },
          { label: 'Target weight, kg', value: round(profile.targetWeightKg), kind: 'number' },
          { label: 'Activity level', value: profile.activityLevel },
          { label: 'Goal', value: profile.goal },
          { label: 'Units', value: profile.unitSystem },
          { label: 'Timezone', value: profile.timezone },
          { label: 'Language', value: profile.locale },
          {
            label: 'Manual calories, kcal',
            value: round(profile.manualCalorieTargetKcal, 0),
            kind: 'number',
          },
          {
            label: 'Manual protein, g',
            value: round(profile.manualProteinTargetG),
            kind: 'number',
          },
          { label: 'Manual carbs, g', value: round(profile.manualCarbsTargetG), kind: 'number' },
          { label: 'Manual fat, g', value: round(profile.manualFatTargetG), kind: 'number' },
          {
            label: 'Onboarding completed',
            value: isoDateTime(profile.onboardingCompletedAt),
            kind: 'datetime',
          },
        ]
      : [{ label: 'Profile', value: 'Not created' }];

    const foodTable: AdminTable = {
      columns: [
        { key: 'date', label: 'Day', kind: 'date' },
        { key: 'meal', label: 'Meal' },
        { key: 'name', label: 'Food' },
        { key: 'amount', label: 'Amount' },
        { key: 'kcal', label: 'kcal', kind: 'number' },
        { key: 'protein', label: 'P, g', kind: 'number' },
        { key: 'carbs', label: 'C, g', kind: 'number' },
        { key: 'fat', label: 'F, g', kind: 'number' },
      ],
      rows: foodEntries.map((entry) => ({
        date: isoDate(entry.localDate),
        meal: entry.meal,
        name: entry.name,
        amount: `${round(entry.amount, 2)} ${entry.unit}`,
        kcal: round(entry.energyKcal, 0),
        protein: round(entry.proteinG),
        carbs: round(entry.carbsG),
        fat: round(entry.fatG),
      })),
      total: counts.foodEntries,
    };

    const activityTable: AdminTable = {
      columns: [
        { key: 'date', label: 'Day', kind: 'date' },
        { key: 'type', label: 'Activity' },
        { key: 'title', label: 'Title' },
        { key: 'minutes', label: 'Min', kind: 'number' },
        { key: 'km', label: 'Km', kind: 'number' },
        { key: 'sets', label: 'Sets x reps' },
        { key: 'kcal', label: 'kcal', kind: 'number' },
      ],
      rows: activityEntries.map((entry) => ({
        date: isoDate(entry.localDate),
        type: entry.activityType.name,
        title: entry.title,
        minutes: entry.durationSec === null ? null : round(entry.durationSec / 60),
        km: entry.distanceM === null ? null : round(entry.distanceM / 1000, 2),
        sets: entry.sets || entry.reps ? `${entry.sets ?? '-'} x ${entry.reps ?? '-'}` : null,
        kcal: round(entry.energyKcal, 0),
      })),
      total: counts.activityEntries,
    };

    const weightTable: AdminTable = {
      columns: [
        { key: 'date', label: 'Day', kind: 'date' },
        { key: 'kg', label: 'Kg', kind: 'number' },
        { key: 'note', label: 'Note' },
      ],
      rows: weightEntries.map((entry) => ({
        date: isoDate(entry.date),
        kg: round(entry.weightKg, 2),
        note: entry.note,
      })),
      total: counts.weightEntries,
    };

    const goalsTable: AdminTable = {
      columns: [
        { key: 'date', label: 'Day', kind: 'date' },
        { key: 'kcal', label: 'kcal', kind: 'number' },
        { key: 'protein', label: 'P, g', kind: 'number' },
        { key: 'carbs', label: 'C, g', kind: 'number' },
        { key: 'fat', label: 'F, g', kind: 'number' },
        { key: 'source', label: 'Source' },
      ],
      rows: dailyGoals.map((goal) => ({
        date: isoDate(goal.date),
        kcal: round(goal.calorieTargetKcal, 0),
        protein: round(goal.proteinTargetG),
        carbs: round(goal.carbsTargetG),
        fat: round(goal.fatTargetG),
        source: goal.source,
      })),
      total: counts.dailyGoals,
    };

    const workoutsTable: AdminTable = {
      columns: [
        { key: 'name', label: 'Routine' },
        { key: 'exercises', label: 'Exercises', kind: 'number' },
        { key: 'plans', label: 'Planned', kind: 'number' },
        { key: 'lastUsed', label: 'Last used', kind: 'datetime' },
        { key: 'created', label: 'Created', kind: 'datetime' },
      ],
      rows: workouts.map((workout) => ({
        name: workout.name,
        exercises: workout._count.exercises,
        plans: workout._count.plans,
        lastUsed: isoDateTime(workout.lastUsedAt),
        created: workout.createdAt.toISOString(),
      })),
      total: counts.workouts,
    };

    const plansTable: AdminTable = {
      columns: [
        { key: 'date', label: 'Day', kind: 'date' },
        { key: 'name', label: 'Plan' },
        { key: 'kind', label: 'Kind' },
        { key: 'done', label: 'Done', kind: 'datetime' },
      ],
      rows: plannedSessions.map((plan) => ({
        date: isoDate(plan.localDate),
        name:
          plan.name ?? plan.workout?.name ?? plan.exercise?.name ?? plan.activityType?.name ?? null,
        kind: plan.workoutId ? 'routine' : plan.exerciseId ? 'exercise' : 'activity',
        done: isoDateTime(plan.completedAt),
      })),
      total: counts.plannedSessions,
    };

    const foodsTable: AdminTable = {
      columns: [
        { key: 'name', label: 'Food' },
        { key: 'brand', label: 'Brand' },
        { key: 'serving', label: 'Serving' },
        { key: 'kcal', label: 'kcal', kind: 'number' },
        { key: 'created', label: 'Created', kind: 'datetime' },
      ],
      rows: foods.map((food) => ({
        name: food.name,
        brand: food.brand,
        serving: `${round(food.servingSize, 2)} ${food.servingUnit}`,
        kcal: round(food.energyKcal, 0),
        created: food.createdAt.toISOString(),
      })),
      total: counts.foods,
    };

    const sessionsTable: AdminTable = {
      columns: [
        { key: 'created', label: 'Issued', kind: 'datetime' },
        { key: 'expires', label: 'Expires', kind: 'datetime' },
        { key: 'state', label: 'State' },
      ],
      rows: sessions.map((session) => ({
        created: session.createdAt.toISOString(),
        expires: session.expiresAt.toISOString(),
        state: session.revokedAt
          ? 'revoked'
          : session.rotatedAt
            ? 'rotated'
            : session.expiresAt <= now
              ? 'expired'
              : 'active',
      })),
      total: counts.sessions,
    };

    return {
      user: toSummary(user),
      sections: [
        { key: 'account', title: 'Account', fields: account },
        { key: 'profile', title: 'Profile', fields: profileFields },
        {
          key: 'usage',
          title: 'Usage',
          fields: [
            { label: 'Food entries', value: counts.foodEntries, kind: 'number' },
            { label: 'Activity entries', value: counts.activityEntries, kind: 'number' },
            { label: 'Weight entries', value: counts.weightEntries, kind: 'number' },
            { label: 'Custom foods', value: counts.foods, kind: 'number' },
            { label: 'Saved exercises', value: counts.savedExercises, kind: 'number' },
            { label: 'Routines', value: counts.workouts, kind: 'number' },
            { label: 'Planned sessions', value: counts.plannedSessions, kind: 'number' },
            { label: 'Daily targets', value: counts.dailyGoals, kind: 'number' },
            { label: 'First food entry', value: isoDate(counts.firstFoodDay), kind: 'date' },
            { label: 'Last food entry', value: isoDate(counts.lastFoodDay), kind: 'date' },
          ],
        },
        { key: 'food-entries', title: 'Food diary', table: foodTable },
        { key: 'activity-entries', title: 'Activities', table: activityTable },
        { key: 'weight', title: 'Weight', table: weightTable },
        { key: 'daily-goals', title: 'Daily targets', table: goalsTable },
        { key: 'workouts', title: 'Routines', table: workoutsTable },
        { key: 'plans', title: 'Calendar', table: plansTable },
        { key: 'foods', title: 'Custom foods', table: foodsTable },
        { key: 'sessions', title: 'Sessions', table: sessionsTable },
      ],
    };
  }

  private async countRecords(userId: string) {
    const where = { userId };
    const [
      foodEntries,
      activityEntries,
      weightEntries,
      foods,
      savedExercises,
      workouts,
      plannedSessions,
      dailyGoals,
      sessions,
      foodRange,
    ] = await this.prisma.$transaction([
      this.prisma.foodEntry.count({ where }),
      this.prisma.activityEntry.count({ where }),
      this.prisma.weightEntry.count({ where }),
      this.prisma.food.count({ where }),
      this.prisma.savedExercise.count({ where }),
      this.prisma.workout.count({ where }),
      this.prisma.plannedSession.count({ where }),
      this.prisma.dailyGoal.count({ where }),
      this.prisma.refreshToken.count({ where }),
      this.prisma.foodEntry.aggregate({
        where,
        _min: { localDate: true },
        _max: { localDate: true },
      }),
    ]);

    return {
      foodEntries,
      activityEntries,
      weightEntries,
      foods,
      savedExercises,
      workouts,
      plannedSessions,
      dailyGoals,
      sessions,
      firstFoodDay: foodRange._min.localDate,
      lastFoodDay: foodRange._max.localDate,
    };
  }
}
