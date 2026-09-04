import { Injectable, NotFoundException } from '@nestjs/common';
import type { WeightEntry } from '@prisma/client';

import {
  instantForLocalDate,
  parseLocalDate,
  toLocalDateString,
  type LocalDateString,
} from '../../common/date/local-date';
import { calculateWeightSummary } from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { UserContextService } from '../user-context/user-context.service';
import type {
  UpsertWeightDto,
  WeightEntryDto,
  WeightHistoryQueryDto,
  WeightSummaryDto,
} from './dto/weight.dto';

@Injectable()
export class WeightService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
  ) {}

  async getSummary(userId: string, query: WeightHistoryQueryDto): Promise<WeightSummaryDto> {
    const context = await this.userContext.getContext(userId);

    const entries = await this.prisma.weightEntry.findMany({
      where: {
        userId,
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: parseLocalDate(query.from) } : {}),
                ...(query.to ? { lte: parseLocalDate(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'asc' },
      take: query.limit,
    });

    const points = entries.map((entry) => ({
      date: toLocalDateString(entry.date),
      weightKg: entry.weightKg,
    }));

    return {
      ...calculateWeightSummary(points),
      targetWeightKg: context.profile.targetWeightKg,
      entries: entries.map(toWeightEntryDto),
    };
  }

  async upsert(
    userId: string,
    date: LocalDateString,
    dto: UpsertWeightDto,
  ): Promise<WeightEntryDto> {
    const timezone = await this.userContext.getTimezone(userId);
    const recordedAt = instantForLocalDate(date, timezone);
    const note = dto.note?.trim() || null;

    const entry = await this.prisma.weightEntry.upsert({
      where: { userId_date: { userId, date: parseLocalDate(date) } },
      create: { userId, date: parseLocalDate(date), weightKg: dto.weightKg, note, recordedAt },
      update: { weightKg: dto.weightKg, note },
    });

    return toWeightEntryDto(entry);
  }

  async remove(userId: string, date: LocalDateString): Promise<void> {
    const deleted = await this.prisma.weightEntry.deleteMany({
      where: { userId, date: parseLocalDate(date) },
    });

    if (deleted.count === 0) {
      throw new NotFoundException('No weight recorded for this day');
    }
  }
}

export const toWeightEntryDto = (entry: WeightEntry): WeightEntryDto => ({
  id: entry.id,
  date: toLocalDateString(entry.date),
  weightKg: entry.weightKg,
  note: entry.note,
});
