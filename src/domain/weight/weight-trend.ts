import { round } from '../units';

export interface WeightPoint {
  date: string;
  weightKg: number;
}

export interface WeightSummary {
  currentWeightKg: number | null;
  startingWeightKg: number | null;
  totalChangeKg: number | null;
  trendKgPerWeek: number | null;
}

export const TREND_WINDOW_DAYS = 28;
export const MIN_POINTS_FOR_TREND = 3;

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

const toDayNumber = (date: string): number =>
  Math.round(new Date(`${date}T00:00:00.000Z`).getTime() / MS_PER_DAY);

export const calculateWeightTrendKgPerWeek = (points: readonly WeightPoint[]): number | null => {
  if (points.length < MIN_POINTS_FOR_TREND) {
    return null;
  }

  const latestDay = toDayNumber(points[points.length - 1].date);
  const window = points.filter((point) => latestDay - toDayNumber(point.date) <= TREND_WINDOW_DAYS);

  if (window.length < MIN_POINTS_FOR_TREND) {
    return null;
  }

  const days = window.map((point) => toDayNumber(point.date));
  const meanDay = days.reduce((sum, day) => sum + day, 0) / days.length;
  const meanWeight = window.reduce((sum, point) => sum + point.weightKg, 0) / window.length;

  let covariance = 0;
  let variance = 0;

  window.forEach((point, index) => {
    const dayDelta = days[index] - meanDay;

    covariance += dayDelta * (point.weightKg - meanWeight);
    variance += dayDelta * dayDelta;
  });

  if (variance === 0) {
    return null;
  }

  return round((covariance / variance) * DAYS_PER_WEEK, 2);
};

export const calculateWeightSummary = (points: readonly WeightPoint[]): WeightSummary => {
  if (points.length === 0) {
    return {
      currentWeightKg: null,
      startingWeightKg: null,
      totalChangeKg: null,
      trendKgPerWeek: null,
    };
  }

  const startingWeightKg = points[0].weightKg;
  const currentWeightKg = points[points.length - 1].weightKg;

  return {
    currentWeightKg: round(currentWeightKg, 1),
    startingWeightKg: round(startingWeightKg, 1),
    totalChangeKg: round(currentWeightKg - startingWeightKg, 1),
    trendKgPerWeek: calculateWeightTrendKgPerWeek(points),
  };
};
