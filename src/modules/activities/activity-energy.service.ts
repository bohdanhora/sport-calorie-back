import { Injectable } from '@nestjs/common';
import type { ActivityType, Intensity } from '@prisma/client';

import type { LocalDateString } from '../../common/date/local-date';
import {
  FALLBACK_BODY_WEIGHT_KG,
  deriveWalkingMetrics,
  estimateActivityEnergy,
  type WalkingMetrics,
} from '../../domain';
import { UserContextService } from '../user-context/user-context.service';
import type { ActivityEnergyEstimateDto } from './dto/activity-entry-response.dto';

export interface ActivityMeasurements {
  durationSec?: number | null;
  distanceM?: number | null;
  avgSpeedKmh?: number | null;
  inclinePercent?: number | null;
  reps?: number | null;
  intensity?: Intensity | null;
}

export interface ActivityEnergyResult extends ActivityEnergyEstimateDto {
  metrics: WalkingMetrics;
}

@Injectable()
export class ActivityEnergyService {
  constructor(private readonly userContext: UserContextService) {}

  async estimate(
    userId: string,
    activityType: ActivityType,
    date: LocalDateString,
    measurements: ActivityMeasurements,
  ): Promise<ActivityEnergyResult> {
    const recordedWeightKg = await this.userContext.getWeightOnOrBefore(userId, date);
    const basedOnWeightKg = recordedWeightKg ?? FALLBACK_BODY_WEIGHT_KG;

    const metrics = deriveWalkingMetrics({
      durationSec: measurements.durationSec,
      distanceM: measurements.distanceM,
      avgSpeedKmh: measurements.avgSpeedKmh,
    });

    const estimate = estimateActivityEnergy({
      category: activityType.category,
      metModerate: activityType.metModerate,
      weightKg: basedOnWeightKg,
      intensity: measurements.intensity ?? null,
      durationSec: metrics.durationSec,
      distanceM: metrics.distanceM,
      avgSpeedKmh: metrics.avgSpeedKmh,
      inclinePercent: measurements.inclinePercent,
      reps: measurements.reps,
    });

    return {
      energyKcal: estimate.energyKcal,
      met: estimate.met,
      effectiveDurationSec: estimate.effectiveDurationSec,
      distanceM: metrics.distanceM,
      avgSpeedKmh: metrics.avgSpeedKmh,
      basedOnWeightKg,
      usedFallbackWeight: recordedWeightKg === null,
      metrics,
    };
  }
}
