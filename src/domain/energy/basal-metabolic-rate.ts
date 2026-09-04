import { BiologicalSex } from '@prisma/client';

import { round } from '../units';

export interface BmrInput {
  sex: BiologicalSex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}

const WEIGHT_COEFFICIENT = 10;
const HEIGHT_COEFFICIENT = 6.25;
const AGE_COEFFICIENT = 5;

const SEX_CONSTANT: Record<BiologicalSex, number> = {
  [BiologicalSex.MALE]: 5,
  [BiologicalSex.FEMALE]: -161,
};

const MIN_PLAUSIBLE_BMR_KCAL = 800;

export const calculateBmr = ({ sex, weightKg, heightCm, ageYears }: BmrInput): number => {
  const mifflinStJeor =
    WEIGHT_COEFFICIENT * weightKg +
    HEIGHT_COEFFICIENT * heightCm -
    AGE_COEFFICIENT * ageYears +
    SEX_CONSTANT[sex];

  return round(Math.max(mifflinStJeor, MIN_PLAUSIBLE_BMR_KCAL));
};

export const calculateAgeYears = (birthDate: Date, on: Date): number => {
  let age = on.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - birthDate.getUTCMonth();
  const dayDelta = on.getUTCDate() - birthDate.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return Math.max(age, 0);
};
