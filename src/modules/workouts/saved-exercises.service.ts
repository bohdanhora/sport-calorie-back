import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EnergySource, type ActivityType, type Prisma, type SavedExercise } from '@prisma/client';

import { deriveWalkingMetrics } from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityEnergyService } from '../activities/activity-energy.service';
import { ActivityEntriesService } from '../activities/activity-entries.service';
import { ActivityTypesService, toActivityTypeDto } from '../activities/activity-types.service';
import type { CreateActivityEntryDto } from '../activities/dto/activity-entry-request.dto';
import type { ActivityEntryDto } from '../activities/dto/activity-entry-response.dto';
import { UserContextService } from '../user-context/user-context.service';
import type {
  CreateSavedExerciseDto,
  SavedExerciseDto,
  UpdateSavedExerciseDto,
} from './dto/saved-exercise.dto';

export type SavedExerciseWithType = SavedExercise & { activityType: ActivityType };

type ExerciseValues = Pick<
  SavedExercise,
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

export const SAVED_EXERCISE_ORDER: Prisma.SavedExerciseOrderByWithRelationInput[] = [
  { lastUsedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
];

const pick = <T>(next: T | undefined, current: T): T => (next === undefined ? current : next);

@Injectable()
export class SavedExercisesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityTypes: ActivityTypesService,
    private readonly activityEnergy: ActivityEnergyService,
    private readonly activityEntries: ActivityEntriesService,
    private readonly userContext: UserContextService,
  ) {}

  async list(userId: string): Promise<SavedExerciseDto[]> {
    const [exercises, weightKg] = await Promise.all([
      this.prisma.savedExercise.findMany({
        where: { userId },
        include: { activityType: true },
        orderBy: SAVED_EXERCISE_ORDER,
      }),
      this.currentWeight(userId),
    ]);

    return exercises.map((exercise) => this.toDto(exercise, userId, weightKg));
  }

  async create(userId: string, dto: CreateSavedExerciseDto): Promise<SavedExerciseDto> {
    const activityType = await this.activityTypes.getAvailable(userId, dto.activityTypeId);
    const values = normaliseValues({
      durationSec: dto.durationSec ?? null,
      distanceM: dto.distanceM ?? null,
      avgSpeedKmh: dto.avgSpeedKmh ?? null,
      inclinePercent: dto.inclinePercent ?? null,
      sets: dto.sets ?? null,
      reps: dto.reps ?? null,
      intensity: dto.intensity ?? null,
      energyKcal: dto.energyKcal ?? null,
      notes: dto.notes ?? null,
    });

    const exercise = await this.prisma.savedExercise.create({
      data: { userId, activityTypeId: activityType.id, name: dto.name.trim(), ...values },
      include: { activityType: true },
    });

    return this.toDto(exercise, userId, await this.currentWeight(userId));
  }

  async update(
    userId: string,
    exerciseId: string,
    dto: UpdateSavedExerciseDto,
  ): Promise<SavedExerciseDto> {
    const existing = await this.findOwned(userId, exerciseId);
    const activityType = dto.activityTypeId
      ? await this.activityTypes.getAvailable(userId, dto.activityTypeId)
      : existing.activityType;

    const values = normaliseValues({
      durationSec: pick(dto.durationSec, existing.durationSec),
      distanceM: pick(dto.distanceM, existing.distanceM),
      avgSpeedKmh: pick(dto.avgSpeedKmh, existing.avgSpeedKmh),
      inclinePercent: pick(dto.inclinePercent, existing.inclinePercent),
      sets: pick(dto.sets, existing.sets),
      reps: pick(dto.reps, existing.reps),
      intensity: pick(dto.intensity, existing.intensity),
      energyKcal: pick(dto.energyKcal, existing.energyKcal),
      notes: pick(dto.notes, existing.notes),
    });

    const exercise = await this.prisma.savedExercise.update({
      where: { id: exerciseId },
      data: {
        activityTypeId: activityType.id,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...values,
      },
      include: { activityType: true },
    });

    return this.toDto(exercise, userId, await this.currentWeight(userId));
  }

  async remove(userId: string, exerciseId: string): Promise<void> {
    await this.findOwned(userId, exerciseId);
    await this.prisma.savedExercise.delete({ where: { id: exerciseId } });
  }

  async log(userId: string, exerciseId: string, date?: string): Promise<ActivityEntryDto> {
    const exercise = await this.findOwned(userId, exerciseId);
    const [entry] = await this.activityEntries.createMany(userId, [toEntryInput(exercise, date)]);

    await this.prisma.savedExercise.update({
      where: { id: exerciseId },
      data: { lastUsedAt: new Date() },
    });

    return entry;
  }

  async currentWeight(userId: string): Promise<number | null> {
    const today = await this.userContext.resolveDate(userId);

    return this.userContext.getWeightOnOrBefore(userId, today);
  }

  toDto(
    exercise: SavedExerciseWithType,
    userId: string,
    weightKg: number | null,
  ): SavedExerciseDto {
    const estimate = this.activityEnergy.estimateForWeight(exercise.activityType, weightKg, {
      durationSec: exercise.durationSec,
      distanceM: exercise.distanceM,
      avgSpeedKmh: exercise.avgSpeedKmh,
      inclinePercent: exercise.inclinePercent,
      reps: exercise.reps,
      intensity: exercise.intensity,
    });

    return {
      id: exercise.id,
      name: exercise.name,
      activityType: toActivityTypeDto(exercise.activityType, userId),
      durationSec: exercise.durationSec,
      distanceM: exercise.distanceM,
      avgSpeedKmh: exercise.avgSpeedKmh,
      inclinePercent: exercise.inclinePercent,
      sets: exercise.sets,
      reps: exercise.reps,
      intensity: exercise.intensity,
      notes: exercise.notes,
      energyKcal: exercise.energyKcal ?? estimate.energyKcal,
      energySource: exercise.energyKcal === null ? EnergySource.ESTIMATED : EnergySource.MANUAL,
      effectiveDurationSec: estimate.effectiveDurationSec,
      lastUsedAt: exercise.lastUsedAt?.toISOString() ?? null,
    };
  }

  private async findOwned(userId: string, exerciseId: string): Promise<SavedExerciseWithType> {
    const exercise = await this.prisma.savedExercise.findFirst({
      where: { id: exerciseId, userId },
      include: { activityType: true },
    });

    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }

    return exercise;
  }
}

const normaliseValues = (values: ExerciseValues): ExerciseValues => {
  const metrics = deriveWalkingMetrics(values);
  const hasMeasurement = Boolean(metrics.durationSec || metrics.distanceM || values.reps);

  if (!hasMeasurement && values.energyKcal === null) {
    throw new BadRequestException(
      'An exercise needs a duration, a distance, repetitions or the calories it burns',
    );
  }

  return {
    ...values,
    durationSec: metrics.durationSec,
    distanceM: metrics.distanceM,
    avgSpeedKmh: metrics.avgSpeedKmh,
    notes: values.notes?.trim() || null,
  };
};

export const toEntryInput = (
  exercise: SavedExerciseWithType,
  date: string | undefined,
): CreateActivityEntryDto => ({
  activityTypeId: exercise.activityTypeId,
  title: exercise.name,
  durationSec: exercise.durationSec,
  distanceM: exercise.distanceM,
  avgSpeedKmh: exercise.avgSpeedKmh,
  inclinePercent: exercise.inclinePercent,
  sets: exercise.sets,
  reps: exercise.reps,
  intensity: exercise.intensity,
  energyKcal: exercise.energyKcal,
  notes: exercise.notes,
  date,
});
