import { round } from '../units';

export interface NutritionValues {
  energyKcal: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

export interface NutritionTotals {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const EMPTY_NUTRITION_TOTALS: NutritionTotals = {
  energyKcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

export const sumNutrition = (values: readonly NutritionValues[]): NutritionTotals => {
  const totals = values.reduce<NutritionTotals>(
    (accumulator, value) => ({
      energyKcal: accumulator.energyKcal + value.energyKcal,
      proteinG: accumulator.proteinG + (value.proteinG ?? 0),
      carbsG: accumulator.carbsG + (value.carbsG ?? 0),
      fatG: accumulator.fatG + (value.fatG ?? 0),
    }),
    { ...EMPTY_NUTRITION_TOTALS },
  );

  return {
    energyKcal: round(totals.energyKcal),
    proteinG: round(totals.proteinG, 1),
    carbsG: round(totals.carbsG, 1),
    fatG: round(totals.fatG, 1),
  };
};
