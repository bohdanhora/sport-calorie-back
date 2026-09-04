import { METRES_PER_KILOMETRE, round, secondsToHours, SECONDS_PER_HOUR } from '../units';

export interface WalkingMetricsInput {
  durationSec?: number | null;
  distanceM?: number | null;
  avgSpeedKmh?: number | null;
}

export interface WalkingMetrics {
  durationSec: number | null;
  distanceM: number | null;
  avgSpeedKmh: number | null;
}

const isPositive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export const calculateAverageSpeedKmh = (distanceM: number, durationSec: number): number =>
  round(distanceM / METRES_PER_KILOMETRE / secondsToHours(durationSec), 2);

export const calculateDistanceM = (avgSpeedKmh: number, durationSec: number): number =>
  round(avgSpeedKmh * secondsToHours(durationSec) * METRES_PER_KILOMETRE);

export const calculateDurationSec = (avgSpeedKmh: number, distanceM: number): number =>
  Math.round((distanceM / METRES_PER_KILOMETRE / avgSpeedKmh) * SECONDS_PER_HOUR);

export const deriveWalkingMetrics = ({
  durationSec,
  distanceM,
  avgSpeedKmh,
}: WalkingMetricsInput): WalkingMetrics => {
  const hasDuration = isPositive(durationSec);
  const hasDistance = isPositive(distanceM);
  const hasSpeed = isPositive(avgSpeedKmh);

  if (hasDuration && hasDistance) {
    return {
      durationSec,
      distanceM,
      avgSpeedKmh: calculateAverageSpeedKmh(distanceM, durationSec),
    };
  }

  if (hasDuration && hasSpeed) {
    return {
      durationSec,
      distanceM: calculateDistanceM(avgSpeedKmh, durationSec),
      avgSpeedKmh: round(avgSpeedKmh, 2),
    };
  }

  if (hasDistance && hasSpeed) {
    return {
      durationSec: calculateDurationSec(avgSpeedKmh, distanceM),
      distanceM,
      avgSpeedKmh: round(avgSpeedKmh, 2),
    };
  }

  return {
    durationSec: hasDuration ? durationSec : null,
    distanceM: hasDistance ? distanceM : null,
    avgSpeedKmh: hasSpeed ? round(avgSpeedKmh, 2) : null,
  };
};
