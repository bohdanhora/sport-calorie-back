import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ActivityEntriesService } from '../activities/activity-entries.service';
import type { ActivityEntryDto } from '../activities/dto/activity-entry-response.dto';
import type { SavedExerciseDto } from './dto/saved-exercise.dto';
import type { CreateWorkoutDto, UpdateWorkoutDto, WorkoutDto } from './dto/workout.dto';
import {
  SavedExercisesService,
  toEntryInput,
  type SavedExerciseWithType,
} from './saved-exercises.service';

export const WORKOUT_INCLUDE = {
  exercises: {
    orderBy: { position: 'asc' },
    include: { exercise: { include: { activityType: true } } },
  },
} satisfies Prisma.WorkoutInclude;

export type WorkoutWithExercises = Prisma.WorkoutGetPayload<{ include: typeof WORKOUT_INCLUDE }>;

export const summariseExercises = (
  exercises: SavedExerciseDto[],
): { energyKcal: number; durationSec: number } => ({
  energyKcal: exercises.reduce((sum, exercise) => sum + exercise.energyKcal, 0),
  durationSec: exercises.reduce((sum, exercise) => sum + exercise.effectiveDurationSec, 0),
});

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly savedExercises: SavedExercisesService,
    private readonly activityEntries: ActivityEntriesService,
  ) {}

  async list(userId: string): Promise<WorkoutDto[]> {
    const [workouts, weightKg] = await Promise.all([
      this.prisma.workout.findMany({
        where: { userId },
        include: WORKOUT_INCLUDE,
        orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
      this.savedExercises.currentWeight(userId),
    ]);

    return workouts.map((workout) => this.toDto(workout, userId, weightKg));
  }

  async create(userId: string, dto: CreateWorkoutDto): Promise<WorkoutDto> {
    await this.assertExercisesOwned(userId, dto.exerciseIds);

    const workout = await this.prisma.workout.create({
      data: {
        userId,
        name: dto.name.trim(),
        notes: dto.notes?.trim() || null,
        exercises: {
          create: dto.exerciseIds.map((exerciseId, position) => ({ exerciseId, position })),
        },
      },
      include: WORKOUT_INCLUDE,
    });

    return this.toDto(workout, userId, await this.savedExercises.currentWeight(userId));
  }

  async update(userId: string, workoutId: string, dto: UpdateWorkoutDto): Promise<WorkoutDto> {
    await this.findOwned(userId, workoutId);

    if (dto.exerciseIds) {
      await this.assertExercisesOwned(userId, dto.exerciseIds);
    }

    const workout = await this.prisma.$transaction(async (tx) => {
      if (dto.exerciseIds) {
        await tx.workoutExercise.deleteMany({ where: { workoutId } });
        await tx.workoutExercise.createMany({
          data: dto.exerciseIds.map((exerciseId, position) => ({
            workoutId,
            exerciseId,
            position,
          })),
        });
      }

      return tx.workout.update({
        where: { id: workoutId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        },
        include: WORKOUT_INCLUDE,
      });
    });

    return this.toDto(workout, userId, await this.savedExercises.currentWeight(userId));
  }

  async remove(userId: string, workoutId: string): Promise<void> {
    await this.findOwned(userId, workoutId);
    await this.prisma.workout.delete({ where: { id: workoutId } });
  }

  async log(userId: string, workoutId: string, date?: string): Promise<ActivityEntryDto[]> {
    const workout = await this.findOwned(userId, workoutId);
    const exercises = workout.exercises.map((item) => item.exercise);

    if (exercises.length === 0) {
      throw new BadRequestException('This workout has no exercises');
    }

    const entries = await this.activityEntries.createMany(
      userId,
      exercises.map((exercise) => toEntryInput(exercise, date)),
    );

    await this.markUsed(workoutId, exercises);

    return entries;
  }

  async findOwned(userId: string, workoutId: string): Promise<WorkoutWithExercises> {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
      include: WORKOUT_INCLUDE,
    });

    if (!workout) {
      throw new NotFoundException('Workout not found');
    }

    return workout;
  }

  async markUsed(workoutId: string | null, exercises: SavedExerciseWithType[]): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction([
      ...(workoutId
        ? [this.prisma.workout.update({ where: { id: workoutId }, data: { lastUsedAt: now } })]
        : []),
      this.prisma.savedExercise.updateMany({
        where: { id: { in: exercises.map((exercise) => exercise.id) } },
        data: { lastUsedAt: now },
      }),
    ]);
  }

  toDto(workout: WorkoutWithExercises, userId: string, weightKg: number | null): WorkoutDto {
    const exercises = workout.exercises.map((item) =>
      this.savedExercises.toDto(item.exercise, userId, weightKg),
    );

    return {
      id: workout.id,
      name: workout.name,
      notes: workout.notes,
      exercises,
      ...summariseExercises(exercises),
      lastUsedAt: workout.lastUsedAt?.toISOString() ?? null,
    };
  }

  private async assertExercisesOwned(userId: string, exerciseIds: string[]): Promise<void> {
    const unique = [...new Set(exerciseIds)];
    const owned = await this.prisma.savedExercise.count({
      where: { userId, id: { in: unique } },
    });

    if (owned !== unique.length) {
      throw new NotFoundException('Exercise not found');
    }
  }
}
