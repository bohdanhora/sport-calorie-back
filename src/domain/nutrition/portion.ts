import { FoodUnit } from '@prisma/client';

import { round } from '../units';

export interface FoodNutritionDefinition {
  servingSize: number;
  servingUnit: FoodUnit;
  energyKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface PortionNutrition {
  energyKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export class IncompatibleFoodUnitError extends Error {
  constructor(
    readonly requested: FoodUnit,
    readonly defined: FoodUnit,
  ) {
    super(`Cannot log ${requested} of a food defined in ${defined}`);
    this.name = 'IncompatibleFoodUnitError';
  }
}

export const calculatePortionFactor = (
  food: Pick<FoodNutritionDefinition, 'servingSize' | 'servingUnit'>,
  amount: number,
  unit: FoodUnit,
): number => {
  if (unit === FoodUnit.SERVING) {
    return amount;
  }

  if (unit !== food.servingUnit) {
    throw new IncompatibleFoodUnitError(unit, food.servingUnit);
  }

  if (food.servingSize <= 0) {
    return 0;
  }

  return amount / food.servingSize;
};

const scaleOptional = (value: number | null, factor: number): number | null =>
  value === null ? null : round(value * factor, 1);

export const calculatePortionNutrition = (
  food: FoodNutritionDefinition,
  amount: number,
  unit: FoodUnit,
): PortionNutrition => {
  const factor = calculatePortionFactor(food, amount, unit);

  return {
    energyKcal: round(food.energyKcal * factor, 1),
    proteinG: scaleOptional(food.proteinG, factor),
    carbsG: scaleOptional(food.carbsG, factor),
    fatG: scaleOptional(food.fatG, factor),
  };
};
