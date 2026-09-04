import { Injectable, NotFoundException } from '@nestjs/common';
import type { ActivityType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { ActivityTypeDto } from './dto/activity-type-response.dto';

@Injectable()
export class ActivityTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ActivityTypeDto[]> {
    const types = await this.prisma.activityType.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return types.map((type) => toActivityTypeDto(type, userId));
  }

  async getAvailable(userId: string, activityTypeId: string): Promise<ActivityType> {
    const type = await this.prisma.activityType.findFirst({
      where: { id: activityTypeId, OR: [{ userId }, { userId: null }] },
    });

    if (!type) {
      throw new NotFoundException('Activity type not found');
    }

    return type;
  }
}

export const toActivityTypeDto = (type: ActivityType, userId: string): ActivityTypeDto => ({
  id: type.id,
  slug: type.slug,
  name: type.name,
  category: type.category,
  metModerate: type.metModerate,
  tracksDuration: type.tracksDuration,
  tracksDistance: type.tracksDistance,
  tracksIncline: type.tracksIncline,
  tracksReps: type.tracksReps,
  tracksSets: type.tracksSets,
  tracksIntensity: type.tracksIntensity,
  isOwned: type.userId === userId,
});
