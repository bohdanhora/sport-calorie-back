import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Food, FoodEntry, FoodUnit, Prisma } from '@prisma/client';

import {
  instantForLocalDate,
  parseLocalDate,
  toLocalDateInTimeZone,
  toLocalDateString,
  type LocalDateString,
} from '../../common/date/local-date';
import { IncompatibleFoodUnitError, calculatePortionNutrition } from '../../domain';
import { PrismaService } from '../../prisma/prisma.service';
import { FoodsService } from '../foods/foods.service';
import { UserContextService } from '../user-context/user-context.service';
import type { CreateFoodEntryDto, UpdateFoodEntryDto } from './dto/food-entry-request.dto';
import type { FoodEntryDto } from './dto/food-entry-response.dto';

interface ResolvedNutrition {
  name: string;
  energyKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

interface ResolvedTiming {
  consumedAt: Date;
  localDate: LocalDateString;
}

@Injectable()
export class FoodEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodsService: FoodsService,
    private readonly userContext: UserContextService,
  ) {}

  async listByDate(userId: string, date?: string): Promise<FoodEntryDto[]> {
    const timezone = await this.userContext.getTimezone(userId);
    const localDate = date ?? toLocalDateInTimeZone(new Date(), timezone);

    const entries = await this.prisma.foodEntry.findMany({
      where: { userId, localDate: parseLocalDate(localDate) },
      orderBy: [{ consumedAt: 'asc' }, { createdAt: 'asc' }],
    });

    return entries.map(toFoodEntryDto);
  }

  async create(userId: string, dto: CreateFoodEntryDto): Promise<FoodEntryDto> {
    const timezone = await this.userContext.getTimezone(userId);
    const timing = this.resolveTiming(timezone, dto.date, dto.consumedAt);
    const food = dto.foodId ? await this.foodsService.getOwnedOrCatalog(userId, dto.foodId) : null;
    const nutrition = this.resolveNutrition(dto, food, dto.amount, dto.unit);

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.foodEntry.create({
        data: {
          userId,
          foodId: food?.id ?? null,
          name: nutrition.name,
          meal: dto.meal,
          amount: dto.amount,
          unit: dto.unit,
          energyKcal: nutrition.energyKcal,
          proteinG: nutrition.proteinG,
          carbsG: nutrition.carbsG,
          fatG: nutrition.fatG,
          notes: dto.notes?.trim() || null,
          consumedAt: timing.consumedAt,
          localDate: parseLocalDate(timing.localDate),
        },
      });

      if (food) {
        await this.foodsService.registerUsage(tx, userId, food.id, timing.consumedAt);
      }

      return created;
    });

    return toFoodEntryDto(entry);
  }

  async update(userId: string, entryId: string, dto: UpdateFoodEntryDto): Promise<FoodEntryDto> {
    const existing = await this.findOwned(userId, entryId);
    const timezone = await this.userContext.getTimezone(userId);

    const amount = dto.amount ?? existing.amount;
    const unit = dto.unit ?? existing.unit;
    const portionChanged = amount !== existing.amount || unit !== existing.unit;

    const food = existing.foodId
      ? await this.prisma.food.findUnique({ where: { id: existing.foodId } })
      : null;

    const data: Prisma.FoodEntryUpdateInput = {
      ...(dto.meal !== undefined ? { meal: dto.meal } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
    };

    if (food && portionChanged && dto.energyKcal === undefined) {
      const recalculated = this.calculatePortion(food, amount, unit);

      data.energyKcal = recalculated.energyKcal;
      data.proteinG = recalculated.proteinG;
      data.carbsG = recalculated.carbsG;
      data.fatG = recalculated.fatG;
    }

    if (dto.energyKcal !== undefined) {
      data.energyKcal = dto.energyKcal;
    }
    if (dto.proteinG !== undefined) {
      data.proteinG = dto.proteinG ?? null;
    }
    if (dto.carbsG !== undefined) {
      data.carbsG = dto.carbsG ?? null;
    }
    if (dto.fatG !== undefined) {
      data.fatG = dto.fatG ?? null;
    }

    if (dto.date !== undefined || dto.consumedAt !== undefined) {
      const timing = this.resolveTiming(timezone, dto.date, dto.consumedAt);

      data.consumedAt = timing.consumedAt;
      data.localDate = parseLocalDate(timing.localDate);
    }

    const updated = await this.prisma.foodEntry.update({ where: { id: entryId }, data });

    return toFoodEntryDto(updated);
  }

  async remove(userId: string, entryId: string): Promise<void> {
    await this.findOwned(userId, entryId);
    await this.prisma.foodEntry.delete({ where: { id: entryId } });
  }

  private async findOwned(userId: string, entryId: string): Promise<FoodEntry> {
    const entry = await this.prisma.foodEntry.findFirst({ where: { id: entryId, userId } });

    if (!entry) {
      throw new NotFoundException('Food entry not found');
    }

    return entry;
  }

  private resolveTiming(
    timezone: string,
    date: string | undefined,
    consumedAt: string | undefined,
  ): ResolvedTiming {
    if (consumedAt) {
      const instant = new Date(consumedAt);

      return { consumedAt: instant, localDate: toLocalDateInTimeZone(instant, timezone) };
    }

    const localDate = date ?? toLocalDateInTimeZone(new Date(), timezone);

    return { consumedAt: instantForLocalDate(localDate, timezone), localDate };
  }

  private resolveNutrition(
    dto: CreateFoodEntryDto,
    food: Food | null,
    amount: number,
    unit: FoodUnit,
  ): ResolvedNutrition {
    if (!food) {
      if (!dto.name?.trim()) {
        throw new BadRequestException('A one-off entry needs a name');
      }
      if (dto.energyKcal === undefined) {
        throw new BadRequestException('A one-off entry needs its calories');
      }

      return {
        name: dto.name.trim(),
        energyKcal: dto.energyKcal,
        proteinG: dto.proteinG ?? null,
        carbsG: dto.carbsG ?? null,
        fatG: dto.fatG ?? null,
      };
    }

    const portion = this.calculatePortion(food, amount, unit);

    return {
      name: dto.name?.trim() || food.name,
      energyKcal: dto.energyKcal ?? portion.energyKcal,
      proteinG: dto.proteinG !== undefined ? (dto.proteinG ?? null) : portion.proteinG,
      carbsG: dto.carbsG !== undefined ? (dto.carbsG ?? null) : portion.carbsG,
      fatG: dto.fatG !== undefined ? (dto.fatG ?? null) : portion.fatG,
    };
  }

  private calculatePortion(food: Food, amount: number, unit: FoodUnit) {
    try {
      return calculatePortionNutrition(food, amount, unit);
    } catch (error) {
      if (error instanceof IncompatibleFoodUnitError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}

export const toFoodEntryDto = (entry: FoodEntry): FoodEntryDto => ({
  id: entry.id,
  foodId: entry.foodId,
  name: entry.name,
  meal: entry.meal,
  amount: entry.amount,
  unit: entry.unit,
  energyKcal: entry.energyKcal,
  proteinG: entry.proteinG,
  carbsG: entry.carbsG,
  fatG: entry.fatG,
  notes: entry.notes,
  consumedAt: entry.consumedAt.toISOString(),
  date: toLocalDateString(entry.localDate),
});
