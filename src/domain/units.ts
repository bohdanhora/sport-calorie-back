export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;
export const METRES_PER_KILOMETRE = 1000;
export const MINUTES_PER_HOUR = 60;

export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

export const secondsToMinutes = (seconds: number): number => seconds / SECONDS_PER_MINUTE;
export const secondsToHours = (seconds: number): number => seconds / SECONDS_PER_HOUR;
export const minutesToSeconds = (minutes: number): number => minutes * SECONDS_PER_MINUTE;
export const metresToKilometres = (metres: number): number => metres / METRES_PER_KILOMETRE;
export const kilometresToMetres = (kilometres: number): number => kilometres * METRES_PER_KILOMETRE;

export const round = (value: number, decimals = 0): number => {
  const factor = 10 ** decimals;
  const rounded = Math.round((value + Number.EPSILON) * factor) / factor;
  return rounded === 0 ? 0 : rounded;
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
