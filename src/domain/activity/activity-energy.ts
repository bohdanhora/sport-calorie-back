import { ActivityCategory, type Intensity } from '@prisma/client';

import {
  applyIntensity,
  calculateEnergyFromMet,
  calculateWalkingMet,
  estimateDurationFromRepetitions,
} from './metabolic-equivalent';
import { deriveWalkingMetrics } from './walking';

export interface ActivityEnergyInput {
  category: ActivityCategory;
  metModerate: number;
  weightKg: number;
  intensity?: Intensity | null;
  durationSec?: number | null;
  distanceM?: number | null;
  avgSpeedKmh?: number | null;
  inclinePercent?: number | null;
  reps?: number | null;
}

export interface ActivityEnergyEstimate {
  energyKcal: number;
  met: number;
  effectiveDurationSec: number;
}

export const estimateActivityEnergy = ({
  category,
  metModerate,
  weightKg,
  intensity = null,
  durationSec = null,
  distanceM = null,
  avgSpeedKmh = null,
  inclinePercent = null,
  reps = null,
}: ActivityEnergyInput): ActivityEnergyEstimate => {
  const walking = deriveWalkingMetrics({ durationSec, distanceM, avgSpeedKmh });

  const effectiveDurationSec =
    walking.durationSec ?? (reps && reps > 0 ? estimateDurationFromRepetitions(reps) : 0);

  const met =
    category === ActivityCategory.WALKING && walking.avgSpeedKmh !== null
      ? calculateWalkingMet(walking.avgSpeedKmh, inclinePercent ?? 0)
      : applyIntensity(metModerate, intensity);

  return {
    energyKcal: calculateEnergyFromMet({ met, weightKg, durationSec: effectiveDurationSec }),
    met,
    effectiveDurationSec,
  };
};
