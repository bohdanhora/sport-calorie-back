import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserProfile } from '@prisma/client';

import { parseLocalDate, toLocalDateString } from '../../common/date/local-date';
import { PrismaService } from '../../prisma/prisma.service';
import { TargetsService } from '../targets/targets.service';
import { UserContextService } from '../user-context/user-context.service';
import type { ProfileDto } from './dto/profile-response.dto';
import type { UpdateCalorieTargetDto } from './dto/update-calorie-target.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContextService,
    private readonly targetsService: TargetsService,
  ) {}

  async get(userId: string): Promise<ProfileDto> {
    const context = await this.userContext.getContext(userId);
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return this.toDto(context.profile, account.email, context.latestWeightKg);
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const data: Prisma.UserProfileUpdateInput = {};

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName?.trim() || null;
    }
    if (dto.sex !== undefined) {
      data.sex = dto.sex ?? null;
    }
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate ? parseLocalDate(dto.birthDate) : null;
    }
    if (dto.heightCm !== undefined) {
      data.heightCm = dto.heightCm ?? null;
    }
    if (dto.targetWeightKg !== undefined) {
      data.targetWeightKg = dto.targetWeightKg ?? null;
    }
    if (dto.activityLevel) {
      data.activityLevel = dto.activityLevel;
    }
    if (dto.goal) {
      data.goal = dto.goal;
    }
    if (dto.unitSystem) {
      data.unitSystem = dto.unitSystem;
    }
    if (dto.timezone) {
      data.timezone = dto.timezone;
    }
    if (dto.locale) {
      data.locale = dto.locale;
    }

    await this.prisma.userProfile.update({ where: { userId }, data });

    return this.get(userId);
  }

  async updateCalorieTarget(userId: string, dto: UpdateCalorieTargetDto): Promise<ProfileDto> {
    const data: Prisma.UserProfileUpdateInput = {};

    if (dto.calorieTargetKcal !== undefined) {
      data.manualCalorieTargetKcal = dto.calorieTargetKcal ?? null;
    }
    if (dto.proteinTargetG !== undefined) {
      data.manualProteinTargetG = dto.proteinTargetG ?? null;
    }
    if (dto.carbsTargetG !== undefined) {
      data.manualCarbsTargetG = dto.carbsTargetG ?? null;
    }
    if (dto.fatTargetG !== undefined) {
      data.manualFatTargetG = dto.fatTargetG ?? null;
    }

    await this.prisma.userProfile.update({ where: { userId }, data });

    return this.get(userId);
  }

  private toDto(profile: UserProfile, email: string, currentWeightKg: number | null): ProfileDto {
    return {
      id: profile.userId,
      email,
      displayName: profile.displayName,
      sex: profile.sex,
      birthDate: profile.birthDate ? toLocalDateString(profile.birthDate) : null,
      heightCm: profile.heightCm,
      targetWeightKg: profile.targetWeightKg,
      currentWeightKg,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
      unitSystem: profile.unitSystem,
      timezone: profile.timezone,
      locale: profile.locale,
      manualCalorieTargetKcal: profile.manualCalorieTargetKcal,
      manualProteinTargetG: profile.manualProteinTargetG,
      manualCarbsTargetG: profile.manualCarbsTargetG,
      manualFatTargetG: profile.manualFatTargetG,
      energy: this.targetsService.calculateEnergyProfile(profile, currentWeightKg),
    };
  }
}
