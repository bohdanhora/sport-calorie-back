import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnergySource, type ActivityType, type PlannedSession, type Prisma } from '@prisma/client';

import {
  differenceInLocalDays,
  parseLocalDate,
  toLocalDateString,
  zonedTimeToInstant,
} from '../../common/date/local-date';
import { deriveWalkingMetrics } from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityEnergyService } from '../activities/activity-energy.service';
import { ActivityEntriesService, toActivityEntryDto } from '../activities/activity-entries.service';
import { ActivityTypesService, toActivityTypeDto } from '../activities/activity-types.service';
import type { CreateActivityEntryDto } from '../activities/dto/activity-entry-request.dto';
import { UserContextService } from '../user-context/user-context.service';
import type { CalendarDto, CreatePlanDto, PlanDto, PlanKind, UpdatePlanDto } from './dto/plan.dto';
import type { SavedExerciseDto } from './dto/saved-exercise.dto';
import { SavedExercisesService, toEntryInput } from './saved-exercises.service';
import { summariseExercises, WORKOUT_INCLUDE, WorkoutsService } from './workouts.service';

const MAX_CALENDAR_DAYS = 62;
const MIDDAY_HOUR = 12;

const PLAN_INCLUDE = {
  workout: { include: WORKOUT_INCLUDE },
  exercise: { include: { activityType: true } },
  activityType: true,
  entries: { include: { activityType: true }, orderBy: { performedAt: 'asc' } },
} satisfies Prisma.PlannedSessionInclude;

type PlanWithRelations = Prisma.PlannedSessionGetPayload<{ include: typeof PLAN_INCLUDE }>;

type PlanActivityValues = Pick<
  CreatePlanDto,
  | 'durationSec'
  | 'distanceM'
  | 'avgSpeedKmh'
  | 'inclinePercent'
  | 'sets'
  | 'reps'
  | 'intensity'
  | 'energyKcal'
  | 'notes'
>;

type PlanActivityColumns = Pick<
  PlannedSession,
  | 'durationSec'
  | 'distanceM'
  | 'avgSpeedKmh'
  | 'inclinePercent'
  | 'sets'
  | 'reps'
  | 'intensity'
  | 'energyKcal'
  | 'notes'
>;

const kindOf = (plan: Pick<PlanWithRelations, 'workoutId' | 'exerciseId'>): PlanKind =>
  plan.workoutId ? 'WORKOUT' : plan.exerciseId ? 'EXERCISE' : 'ACTIVITY';

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityTypes: ActivityTypesService,
    private readonly activityEnergy: ActivityEnergyService,
    private readonly activityEntries: ActivityEntriesService,
    private readonly savedExercises: SavedExercisesService,
    private readonly workouts: WorkoutsService,
    private readonly userContext: UserContextService,
  ) {}

  async calendar(userId: string, from: string, to: string): Promise<CalendarDto> {
    const days = differenceInLocalDays(from, to);

    if (days < 0 || days >= MAX_CALENDAR_DAYS) {
      throw new BadRequestException(`Choose a range of 1 to ${MAX_CALENDAR_DAYS} days`);
    }

    const localDate = { gte: parseLocalDate(from), lte: parseLocalDate(to) };

    const [plans, activities, weightKg] = await Promise.all([
      this.prisma.plannedSession.findMany({
        where: { userId, localDate },
        include: PLAN_INCLUDE,
        orderBy: [{ localDate: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.activityEntry.findMany({
        where: { userId, localDate, plannedSessionId: null },
        include: { activityType: true },
        orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.savedExercises.currentWeight(userId),
    ]);

    return {
      plans: plans.map((plan) => this.toDto(plan, userId, weightKg)),
      activities: activities.map((entry) => toActivityEntryDto(entry, userId)),
    };
  }

  async create(userId: string, dto: CreatePlanDto): Promise<PlanDto> {
    const sources = [dto.workoutId, dto.exerciseId, dto.activityTypeId].filter(Boolean);

    if (sources.length !== 1) {
      throw new BadRequestException('Plan exactly one workout, exercise or activity');
    }

    if (dto.workoutId) {
      await this.workouts.findOwned(userId, dto.workoutId);
    }

    if (dto.exerciseId) {
      await this.prisma.savedExercise
        .findFirstOrThrow({ where: { id: dto.exerciseId, userId } })
        .catch(() => {
          throw new NotFoundException('Exercise not found');
        });
    }

    const activity = dto.activityTypeId
      ? this.activityValues(await this.activityTypes.getAvailable(userId, dto.activityTypeId), dto)
      : {};

    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.plannedSession.create({
        data: {
          userId,
          localDate: parseLocalDate(dto.date),
          position: 0,
          workoutId: dto.workoutId ?? null,
          exerciseId: dto.exerciseId ?? null,
          activityTypeId: dto.activityTypeId ?? null,
          name: dto.name?.trim() || null,
          ...activity,
        },
      });

      await this.placeInDay(tx, userId, created.id, dto.date, dto.position);

      return tx.plannedSession.findUniqueOrThrow({
        where: { id: created.id },
        include: PLAN_INCLUDE,
      });
    });

    return this.toDto(plan, userId, await this.savedExercises.currentWeight(userId));
  }

  async update(userId: string, planId: string, dto: UpdatePlanDto): Promise<PlanDto> {
    const existing = await this.findOwned(userId, planId);
    const kind = kindOf(existing);

    if (kind !== 'ACTIVITY' && dto.activityTypeId) {
      throw new BadRequestException('Only a one-off activity can change its activity');
    }

    const activityType =
      kind === 'ACTIVITY'
        ? dto.activityTypeId
          ? await this.activityTypes.getAvailable(userId, dto.activityTypeId)
          : existing.activityType
        : null;

    const activity =
      activityType && kind === 'ACTIVITY'
        ? this.activityValues(activityType, {
            durationSec: pick(dto.durationSec, existing.durationSec),
            distanceM: pick(dto.distanceM, existing.distanceM),
            avgSpeedKmh: pick(dto.avgSpeedKmh, existing.avgSpeedKmh),
            inclinePercent: pick(dto.inclinePercent, existing.inclinePercent),
            sets: pick(dto.sets, existing.sets),
            reps: pick(dto.reps, existing.reps),
            intensity: pick(dto.intensity, existing.intensity),
            energyKcal: pick(dto.energyKcal, existing.energyKcal),
            notes: pick(dto.notes, existing.notes),
          })
        : {};

    const date = dto.date ?? toLocalDateString(existing.localDate);
    const moved = dto.date !== undefined || dto.position !== undefined;

    if (existing.completedAt && date !== toLocalDateString(existing.localDate)) {
      const timezone = await this.userContext.getTimezone(userId);

      await this.prisma.activityEntry.updateMany({
        where: { plannedSessionId: planId, userId },
        data: {
          localDate: parseLocalDate(date),
          performedAt: zonedTimeToInstant(date, timezone, MIDDAY_HOUR),
        },
      });
    }

    const plan = await this.prisma.$transaction(async (tx) => {
      await tx.plannedSession.update({
        where: { id: planId },
        data: {
          localDate: parseLocalDate(date),
          ...(dto.name !== undefined ? { name: dto.name?.trim() || null } : {}),
          ...(activityType ? { activityTypeId: activityType.id } : {}),
          ...activity,
        },
      });

      if (moved) {
        await this.placeInDay(tx, userId, planId, date, dto.position);
      }

      return tx.plannedSession.findUniqueOrThrow({ where: { id: planId }, include: PLAN_INCLUDE });
    });

    return this.toDto(plan, userId, await this.savedExercises.currentWeight(userId));
  }

  async remove(userId: string, planId: string): Promise<void> {
    await this.findOwned(userId, planId);
    await this.prisma.plannedSession.delete({ where: { id: planId } });
  }

  async complete(userId: string, planId: string): Promise<PlanDto> {
    const plan = await this.findOwned(userId, planId);

    if (plan.completedAt) {
      return this.toDto(plan, userId, await this.savedExercises.currentWeight(userId));
    }

    const date = toLocalDateString(plan.localDate);
    const inputs = this.entryInputs(plan, date);

    if (inputs.length === 0) {
      throw new BadRequestException('This plan has nothing to log');
    }

    await this.activityEntries.createMany(userId, inputs, plan.id);
    await this.prisma.plannedSession.update({
      where: { id: planId },
      data: { completedAt: new Date() },
    });

    if (plan.workout) {
      await this.workouts.markUsed(
        plan.workout.id,
        plan.workout.exercises.map((item) => item.exercise),
      );
    } else if (plan.exercise) {
      await this.workouts.markUsed(null, [plan.exercise]);
    }

    const completed = await this.findOwned(userId, planId);

    return this.toDto(completed, userId, await this.savedExercises.currentWeight(userId));
  }

  async reopen(userId: string, planId: string): Promise<PlanDto> {
    await this.findOwned(userId, planId);

    await this.prisma.$transaction([
      this.prisma.activityEntry.deleteMany({ where: { plannedSessionId: planId, userId } }),
      this.prisma.plannedSession.update({ where: { id: planId }, data: { completedAt: null } }),
    ]);

    const reopened = await this.findOwned(userId, planId);

    return this.toDto(reopened, userId, await this.savedExercises.currentWeight(userId));
  }

  private entryInputs(plan: PlanWithRelations, date: string): CreateActivityEntryDto[] {
    if (plan.workout) {
      return plan.workout.exercises.map((item) => toEntryInput(item.exercise, date));
    }

    if (plan.exercise) {
      return [toEntryInput(plan.exercise, date)];
    }

    if (!plan.activityTypeId) {
      return [];
    }

    return [
      {
        activityTypeId: plan.activityTypeId,
        title: plan.name,
        durationSec: plan.durationSec,
        distanceM: plan.distanceM,
        avgSpeedKmh: plan.avgSpeedKmh,
        inclinePercent: plan.inclinePercent,
        sets: plan.sets,
        reps: plan.reps,
        intensity: plan.intensity,
        energyKcal: plan.energyKcal,
        notes: plan.notes,
        date,
      },
    ];
  }

  private activityValues(
    activityType: ActivityType,
    values: PlanActivityValues,
  ): PlanActivityColumns {
    const metrics = deriveWalkingMetrics(values);
    const hasMeasurement = Boolean(metrics.durationSec || metrics.distanceM || values.reps);
    const energyKcal = values.energyKcal ?? null;

    if (!hasMeasurement && energyKcal === null) {
      throw new BadRequestException(
        `${activityType.name} needs a duration, a distance, repetitions or the calories it burns`,
      );
    }

    return {
      durationSec: metrics.durationSec,
      distanceM: metrics.distanceM,
      avgSpeedKmh: metrics.avgSpeedKmh,
      inclinePercent: values.inclinePercent ?? null,
      sets: values.sets ?? null,
      reps: values.reps ?? null,
      intensity: values.intensity ?? null,
      energyKcal,
      notes: values.notes?.trim() || null,
    };
  }

  private async placeInDay(
    tx: Prisma.TransactionClient,
    userId: string,
    planId: string,
    date: string,
    position: number | undefined,
  ): Promise<void> {
    const siblings = await tx.plannedSession.findMany({
      where: { userId, localDate: parseLocalDate(date), id: { not: planId } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const ordered = siblings.map((sibling) => sibling.id);
    const index = Math.min(position ?? ordered.length, ordered.length);

    ordered.splice(index, 0, planId);

    await Promise.all(
      ordered.map((id, place) =>
        tx.plannedSession.update({ where: { id }, data: { position: place } }),
      ),
    );
  }

  private async findOwned(userId: string, planId: string): Promise<PlanWithRelations> {
    const plan = await this.prisma.plannedSession.findFirst({
      where: { id: planId, userId },
      include: PLAN_INCLUDE,
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return plan;
  }

  private toDto(plan: PlanWithRelations, userId: string, weightKg: number | null): PlanDto {
    const exercises = this.planExercises(plan, userId, weightKg);
    const entries = plan.entries.map((entry) => toActivityEntryDto(entry, userId));
    const summary = summariseExercises(exercises);

    return {
      id: plan.id,
      date: toLocalDateString(plan.localDate),
      position: plan.position,
      kind: kindOf(plan),
      name: plan.workout?.name ?? plan.exercise?.name ?? plan.name ?? plan.activityType?.name ?? '',
      workoutId: plan.workoutId,
      exerciseId: plan.exerciseId,
      exercises,
      energyKcal: plan.completedAt
        ? entries.reduce((sum, entry) => sum + entry.energyKcal, 0)
        : summary.energyKcal,
      durationSec: summary.durationSec,
      completedAt: plan.completedAt?.toISOString() ?? null,
      entries,
    };
  }

  private planExercises(
    plan: PlanWithRelations,
    userId: string,
    weightKg: number | null,
  ): SavedExerciseDto[] {
    if (plan.workout) {
      return plan.workout.exercises.map((item) =>
        this.savedExercises.toDto(item.exercise, userId, weightKg),
      );
    }

    if (plan.exercise) {
      return [this.savedExercises.toDto(plan.exercise, userId, weightKg)];
    }

    if (!plan.activityType) {
      return [];
    }

    const estimate = this.activityEnergy.estimateForWeight(plan.activityType, weightKg, plan);

    return [
      {
        id: plan.id,
        name: plan.name ?? plan.activityType.name,
        activityType: toActivityTypeDto(plan.activityType, userId),
        durationSec: plan.durationSec,
        distanceM: plan.distanceM,
        avgSpeedKmh: plan.avgSpeedKmh,
        inclinePercent: plan.inclinePercent,
        sets: plan.sets,
        reps: plan.reps,
        intensity: plan.intensity,
        notes: plan.notes,
        energyKcal: plan.energyKcal ?? estimate.energyKcal,
        energySource: plan.energyKcal === null ? EnergySource.ESTIMATED : EnergySource.MANUAL,
        effectiveDurationSec: estimate.effectiveDurationSec,
        lastUsedAt: null,
      },
    ];
  }
}
