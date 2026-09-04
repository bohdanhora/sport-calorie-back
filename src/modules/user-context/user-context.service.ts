import { Injectable, NotFoundException } from '@nestjs/common';
import type { UserProfile } from '@prisma/client';

import {
  parseLocalDate,
  todayInTimeZone,
  type LocalDateString,
} from '../../common/date/local-date';
import { PrismaService } from '../../prisma/prisma.service';

export interface UserContext {
  userId: string;
  timezone: string;
  profile: UserProfile;
  latestWeightKg: number | null;
}

@Injectable()
export class UserContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(userId: string): Promise<UserContext> {
    const [profile, latestWeight] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.weightEntry.findFirst({
        where: { userId },
        orderBy: { date: 'desc' },
        select: { weightKg: true },
      }),
    ]);

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      userId,
      timezone: profile.timezone,
      profile,
      latestWeightKg: latestWeight?.weightKg ?? null,
    };
  }

  async getTimezone(userId: string): Promise<string> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return profile.timezone;
  }

  async resolveDate(userId: string, date?: string): Promise<LocalDateString> {
    return date ?? todayInTimeZone(await this.getTimezone(userId));
  }

  async getWeightOnOrBefore(userId: string, date: LocalDateString): Promise<number | null> {
    const onOrBefore = await this.prisma.weightEntry.findFirst({
      where: { userId, date: { lte: parseLocalDate(date) } },
      orderBy: { date: 'desc' },
      select: { weightKg: true },
    });

    if (onOrBefore) {
      return onOrBefore.weightKg;
    }

    const earliest = await this.prisma.weightEntry.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { weightKg: true },
    });

    return earliest?.weightKg ?? null;
  }
}
