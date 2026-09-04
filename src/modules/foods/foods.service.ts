import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FoodSource, Prisma, type Food } from '@prisma/client';

import { buildPaginationMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { FoodDto, PaginatedFoodsDto } from './dto/food-response.dto';
import type { CreateFoodDto, FoodQueryDto, UpdateFoodDto } from './dto/food-request.dto';

type FoodWithUsage = Food & { usages: { usageCount: number; lastUsedAt: Date }[] };

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: FoodQueryDto): Promise<PaginatedFoodsDto> {
    const where: Prisma.FoodWhereInput = {
      archivedAt: null,
      OR: [{ userId }, { userId: null }],
      ...(query.search
        ? { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [total, foods] = await Promise.all([
      this.prisma.food.count({ where }),
      this.prisma.food.findMany({
        where,
        include: { usages: { where: { userId }, select: { usageCount: true, lastUsedAt: true } } },
        orderBy: [{ name: 'asc' }],
        take: query.limit,
        skip: query.offset,
      }),
    ]);

    return {
      items: foods.map((food) => this.toDto(food, userId)),
      meta: buildPaginationMeta(total, query.limit, query.offset),
    };
  }

  async listRecent(userId: string, limit: number): Promise<FoodDto[]> {
    const usages = await this.prisma.foodUsage.findMany({
      where: { userId, food: { archivedAt: null } },
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
      include: { food: true },
    });

    return usages.map((usage) =>
      this.toDto(
        { ...usage.food, usages: [{ usageCount: usage.usageCount, lastUsedAt: usage.lastUsedAt }] },
        userId,
      ),
    );
  }

  async getOwnedOrCatalog(userId: string, foodId: string): Promise<Food> {
    const food = await this.prisma.food.findFirst({
      where: { id: foodId, archivedAt: null, OR: [{ userId }, { userId: null }] },
    });

    if (!food) {
      throw new NotFoundException('Food not found');
    }

    return food;
  }

  async create(userId: string, dto: CreateFoodDto): Promise<FoodDto> {
    const food = await this.prisma.food.create({
      data: {
        userId,
        name: dto.name.trim(),
        brand: dto.brand?.trim() || null,
        servingSize: dto.servingSize,
        servingUnit: dto.servingUnit,
        energyKcal: dto.energyKcal,
        proteinG: dto.proteinG ?? null,
        carbsG: dto.carbsG ?? null,
        fatG: dto.fatG ?? null,
        source: FoodSource.MANUAL,
      },
      include: { usages: { where: { userId } } },
    });

    return this.toDto(food, userId);
  }

  async update(userId: string, foodId: string, dto: UpdateFoodDto): Promise<FoodDto> {
    await this.assertOwnership(userId, foodId);

    const food = await this.prisma.food.update({
      where: { id: foodId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.brand !== undefined ? { brand: dto.brand?.trim() || null } : {}),
        ...(dto.servingSize !== undefined ? { servingSize: dto.servingSize } : {}),
        ...(dto.servingUnit !== undefined ? { servingUnit: dto.servingUnit } : {}),
        ...(dto.energyKcal !== undefined ? { energyKcal: dto.energyKcal } : {}),
        ...(dto.proteinG !== undefined ? { proteinG: dto.proteinG ?? null } : {}),
        ...(dto.carbsG !== undefined ? { carbsG: dto.carbsG ?? null } : {}),
        ...(dto.fatG !== undefined ? { fatG: dto.fatG ?? null } : {}),
      },
      include: { usages: { where: { userId } } },
    });

    return this.toDto(food, userId);
  }

  async archive(userId: string, foodId: string): Promise<void> {
    await this.assertOwnership(userId, foodId);

    await this.prisma.food.update({
      where: { id: foodId },
      data: { archivedAt: new Date() },
    });
  }

  async registerUsage(
    tx: Prisma.TransactionClient,
    userId: string,
    foodId: string,
    usedAt: Date,
  ): Promise<void> {
    await tx.foodUsage.upsert({
      where: { userId_foodId: { userId, foodId } },
      create: { userId, foodId, usageCount: 1, lastUsedAt: usedAt },
      update: { usageCount: { increment: 1 }, lastUsedAt: usedAt },
    });
  }

  private async assertOwnership(userId: string, foodId: string): Promise<void> {
    const food = await this.prisma.food.findUnique({
      where: { id: foodId },
      select: { userId: true, archivedAt: true },
    });

    if (!food || food.archivedAt !== null) {
      throw new NotFoundException('Food not found');
    }

    if (food.userId !== userId) {
      throw new ForbiddenException('Shared catalog foods cannot be edited');
    }
  }

  private toDto(food: FoodWithUsage, userId: string): FoodDto {
    const usage = food.usages.at(0);

    return {
      id: food.id,
      name: food.name,
      brand: food.brand,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      energyKcal: food.energyKcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      source: food.source,
      isOwned: food.userId === userId,
      lastUsedAt: usage?.lastUsedAt.toISOString() ?? null,
      usageCount: usage?.usageCount ?? 0,
    };
  }
}
