import { Intensity } from '@prisma/client';

import { METRES_PER_KILOMETRE, MINUTES_PER_HOUR, round, secondsToMinutes } from '../units';

const ML_OXYGEN_PER_MET = 3.5;
const KCAL_PER_LITRE_OXYGEN_DIVISOR = 200;
const RESTING_MET = 1;

export const INTENSITY_FACTORS: Record<Intensity, number> = {
  [Intensity.LOW]: 0.8,
  [Intensity.MODERATE]: 1,
  [Intensity.HIGH]: 1.3,
};

export const SECONDS_PER_REPETITION = 3;

export interface MetEnergyInput {
  met: number;
  weightKg: number;
  durationSec: number;
}

export const calculateEnergyFromMet = ({ met, weightKg, durationSec }: MetEnergyInput): number => {
  if (durationSec <= 0 || weightKg <= 0) {
    return 0;
  }

  const kcalPerMinute =
    (Math.max(met, RESTING_MET) * ML_OXYGEN_PER_MET * weightKg) / KCAL_PER_LITRE_OXYGEN_DIVISOR;

  return round(kcalPerMinute * secondsToMinutes(durationSec));
};

export const calculateWalkingMet = (speedKmh: number, inclinePercent = 0): number => {
  if (speedKmh <= 0) {
    return RESTING_MET;
  }

  const speedMetresPerMinute = (speedKmh * METRES_PER_KILOMETRE) / MINUTES_PER_HOUR;
  const grade = Math.max(inclinePercent, 0) / 100;
  const oxygenUptake =
    0.1 * speedMetresPerMinute + 1.8 * speedMetresPerMinute * grade + ML_OXYGEN_PER_MET;

  return round(Math.max(oxygenUptake / ML_OXYGEN_PER_MET, RESTING_MET), 2);
};

export const applyIntensity = (metModerate: number, intensity: Intensity | null): number =>
  round(metModerate * INTENSITY_FACTORS[intensity ?? Intensity.MODERATE], 2);

export const estimateDurationFromRepetitions = (totalRepetitions: number): number =>
  Math.max(Math.round(totalRepetitions * SECONDS_PER_REPETITION), 0);
