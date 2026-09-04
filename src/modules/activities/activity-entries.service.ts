import { Injectable, NotFoundException } from '@nestjs/common';
import { EnergySource, type ActivityEntry, type ActivityType, type Prisma } from '@prisma/client';

import {
  instantForLocalDate,
  parseLocalDate,
  toLocalDateInTimeZone,
  toLocalDateString,
  type LocalDateString,
} from '../../common/date/local-date';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService } from '../user-context/user-context.service';
import { ActivityEnergyService } from './activity-energy.service';
import { ActivityTypesService, toActivityTypeDto } from './activity-types.service';
import type {
  CreateActivityEntryDto,
  EstimateActivityEnergyDto,
  UpdateActivityEntryDto,
} from './dto/activity-entry-request.dto';
import type {
  ActivityEnergyEstimateDto,
  ActivityEntryDto,
} from './dto/activity-entry-response.dto';

type ActivityEntryWithType = ActivityEntry & { activityType: ActivityType };

interface ResolvedTiming {
  performedAt: Date;
  localDate: LocalDateString;
}

@Injectable()
export class ActivityEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityTypes: ActivityTypesService,
    private readonly activityEnergy: ActivityEnergyService,
    private readonly userContext: UserContextService,
  ) {}

  async listByDate(userId: string, date?: string): Promise<ActivityEntryDto[]> {
    const timezone = await this.userContext.getTimezone(userId);
    const localDate = date ?? toLocalDateInTimeZone(new Date(), timezone);

    const entries = await this.prisma.activityEntry.findMany({
      where: { userId, localDate: parseLocalDate(localDate) },
      include: { activityType: true },
      orderBy: [{ performedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return entries.map((entry) => toActivityEntryDto(entry, userId));
  }

  async estimate(
    userId: string,
    dto: EstimateActivityEnergyDto,
  ): Promise<ActivityEnergyEstimateDto> {
    const timezone = await this.userContext.getTimezone(userId);
    const localDate = dto.date ?? toLocalDateInTimeZone(new Date(), timezone);
    const activityType = await this.activityTypes.getAvailable(userId, dto.activityTypeId);

    const estimate = await this.activityEnergy.estimate(userId, activityType, localDate, dto);

    return {
      energyKcal: estimate.energyKcal,
      met: estimate.met,
      effectiveDurationSec: estimate.effectiveDurationSec,
      distanceM: estimate.distanceM,
      avgSpeedKmh: estimate.avgSpeedKmh,
      basedOnWeightKg: estimate.basedOnWeightKg,
      usedFallbackWeight: estimate.usedFallbackWeight,
    };
  }

  async create(userId: string, dto: CreateActivityEntryDto): Promise<ActivityEntryDto> {
    const timezone = await this.userContext.getTimezone(userId);
    const timing = this.resolveTiming(timezone, dto.date, dto.performedAt);
    const activityType = await this.activityTypes.getAvailable(userId, dto.activityTypeId);

    const estimate = await this.activityEnergy.estimate(
      userId,
      activityType,
      timing.localDate,
      dto,
    );

    const entry = await this.prisma.activityEntry.create({
      data: {
        userId,
        activityTypeId: activityType.id,
        title: dto.title?.trim() || null,
        durationSec: estimate.metrics.durationSec,
        distanceM: estimate.metrics.distanceM,
        avgSpeedKmh: estimate.metrics.avgSpeedKmh,
        inclinePercent: dto.inclinePercent ?? null,
        sets: dto.sets ?? null,
        reps: dto.reps ?? null,
        intensity: dto.intensity ?? null,
        energyKcal: dto.energyKcal ?? estimate.energyKcal,
        energySource:
          dto.energyKcal === null || dto.energyKcal === undefined
            ? EnergySource.ESTIMATED
            : EnergySource.MANUAL,
        notes: dto.notes?.trim() || null,
        performedAt: timing.performedAt,
        localDate: parseLocalDate(timing.localDate),
      },
      include: { activityType: true },
    });

    return toActivityEntryDto(entry, userId);
  }

  async update(
    userId: string,
    entryId: string,
    dto: UpdateActivityEntryDto,
  ): Promise<ActivityEntryDto> {
    const existing = await this.findOwned(userId, entryId);
    const timezone = await this.userContext.getTimezone(userId);

    const timing =
      dto.date !== undefined || dto.performedAt !== undefined
        ? this.resolveTiming(timezone, dto.date, dto.performedAt)
        : { performedAt: existing.performedAt, localDate: toLocalDateString(existing.localDate) };

    const activityType = dto.activityTypeId
      ? await this.activityTypes.getAvailable(userId, dto.activityTypeId)
      : existing.activityType;

    const measurements = {
      durationSec: dto.durationSec !== undefined ? dto.durationSec : existing.durationSec,
      distanceM: dto.distanceM !== undefined ? dto.distanceM : existing.distanceM,
      avgSpeedKmh: dto.avgSpeedKmh !== undefined ? dto.avgSpeedKmh : existing.avgSpeedKmh,
      inclinePercent:
        dto.inclinePercent !== undefined ? dto.inclinePercent : existing.inclinePercent,
      reps: dto.reps !== undefined ? dto.reps : existing.reps,
      intensity: dto.intensity !== undefined ? dto.intensity : existing.intensity,
    };

    const estimate = await this.activityEnergy.estimate(
      userId,
      activityType,
      timing.localDate,
      measurements,
    );

    const manualEnergyKcal =
      dto.energyKcal ??
      (existing.energySource === EnergySource.MANUAL && dto.energyKcal === undefined
        ? existing.energyKcal
        : null);

    const data: Prisma.ActivityEntryUpdateInput = {
      activityType: { connect: { id: activityType.id } },
      ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
      durationSec: estimate.metrics.durationSec,
      distanceM: estimate.metrics.distanceM,
      avgSpeedKmh: estimate.metrics.avgSpeedKmh,
      inclinePercent: measurements.inclinePercent,
      sets: dto.sets !== undefined ? dto.sets : existing.sets,
      reps: measurements.reps,
      intensity: measurements.intensity,
      energyKcal: manualEnergyKcal ?? estimate.energyKcal,
      energySource: manualEnergyKcal === null ? EnergySource.ESTIMATED : EnergySource.MANUAL,
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      performedAt: timing.performedAt,
      localDate: parseLocalDate(timing.localDate),
    };

    const updated = await this.prisma.activityEntry.update({
      where: { id: entryId },
      data,
      include: { activityType: true },
    });

    return toActivityEntryDto(updated, userId);
  }

  async remove(userId: string, entryId: string): Promise<void> {
    await this.findOwned(userId, entryId);
    await this.prisma.activityEntry.delete({ where: { id: entryId } });
  }

  private async findOwned(userId: string, entryId: string): Promise<ActivityEntryWithType> {
    const entry = await this.prisma.activityEntry.findFirst({
      where: { id: entryId, userId },
      include: { activityType: true },
    });

    if (!entry) {
      throw new NotFoundException('Activity not found');
    }

    return entry;
  }

  private resolveTiming(
    timezone: string,
    date: string | undefined,
    performedAt: string | undefined,
  ): ResolvedTiming {
    if (performedAt) {
      const instant = new Date(performedAt);

      return { performedAt: instant, localDate: toLocalDateInTimeZone(instant, timezone) };
    }

    const localDate = date ?? toLocalDateInTimeZone(new Date(), timezone);

    return { performedAt: instantForLocalDate(localDate, timezone), localDate };
  }
}

export const toActivityEntryDto = (
  entry: ActivityEntryWithType,
  userId: string,
): ActivityEntryDto => ({
  id: entry.id,
  activityType: toActivityTypeDto(entry.activityType, userId),
  title: entry.title,
  durationSec: entry.durationSec,
  distanceM: entry.distanceM,
  avgSpeedKmh: entry.avgSpeedKmh,
  inclinePercent: entry.inclinePercent,
  sets: entry.sets,
  reps: entry.reps,
  intensity: entry.intensity,
  energyKcal: entry.energyKcal,
  energySource: entry.energySource,
  notes: entry.notes,
  performedAt: entry.performedAt.toISOString(),
  date: toLocalDateString(entry.localDate),
});
