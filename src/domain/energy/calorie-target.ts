import { ActivityLevel, FitnessGoal } from '@prisma/client';

import { KCAL_PER_GRAM, round } from '../units';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.HIGH]: 1.725,
  [ActivityLevel.VERY_HIGH]: 1.9,
};

export const GOAL_ADJUSTMENTS: Record<FitnessGoal, number> = {
  [FitnessGoal.LOSE_WEIGHT]: -0.15,
  [FitnessGoal.MAINTAIN_WEIGHT]: 0,
  [FitnessGoal.GAIN_WEIGHT]: 0.1,
};

const PROTEIN_G_PER_KG = 1.8;
const FAT_G_PER_KG = 0.8;

const FALLBACK_MACRO_SPLIT = { protein: 0.3, fat: 0.3, carbs: 0.4 } as const;

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export const calculateTdee = (bmrKcal: number, activityLevel: ActivityLevel): number =>
  round(bmrKcal * ACTIVITY_FACTORS[activityLevel]);

export const calculateRecommendedCalorieTarget = (
  tdeeKcal: number,
  goal: FitnessGoal,
  bmrKcal: number,
): number => round(Math.max(tdeeKcal * (1 + GOAL_ADJUSTMENTS[goal]), bmrKcal));

export const calculateMacroTargets = (
  calorieTargetKcal: number,
  weightKg: number | null,
): MacroTargets => {
  if (weightKg === null || weightKg <= 0) {
    return {
      proteinG: round((calorieTargetKcal * FALLBACK_MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein),
      carbsG: round((calorieTargetKcal * FALLBACK_MACRO_SPLIT.carbs) / KCAL_PER_GRAM.carbs),
      fatG: round((calorieTargetKcal * FALLBACK_MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat),
    };
  }

  let proteinG = weightKg * PROTEIN_G_PER_KG;
  let fatG = weightKg * FAT_G_PER_KG;

  const anchoredKcal = proteinG * KCAL_PER_GRAM.protein + fatG * KCAL_PER_GRAM.fat;

  if (anchoredKcal > calorieTargetKcal) {
    const scale = calorieTargetKcal / anchoredKcal;
    proteinG *= scale;
    fatG *= scale;
  }

  const remainingKcal =
    calorieTargetKcal - (proteinG * KCAL_PER_GRAM.protein + fatG * KCAL_PER_GRAM.fat);

  return {
    proteinG: round(proteinG),
    carbsG: round(Math.max(remainingKcal, 0) / KCAL_PER_GRAM.carbs),
    fatG: round(fatG),
  };
};
