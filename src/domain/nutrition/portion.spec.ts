import { FoodUnit } from '@prisma/client';

import {
  IncompatibleFoodUnitError,
  calculatePortionNutrition,
  type FoodNutritionDefinition,
} from './portion';

const chickenBreast: FoodNutritionDefinition = {
  servingSize: 100,
  servingUnit: FoodUnit.GRAM,
  energyKcal: 165,
  proteinG: 31,
  carbsG: 0,
  fatG: 3.6,
};

describe('calculatePortionNutrition', () => {
  it('scales nutrition to the logged amount', () => {
    expect(calculatePortionNutrition(chickenBreast, 200, FoodUnit.GRAM)).toEqual({
      energyKcal: 330,
      proteinG: 62,
      carbsG: 0,
      fatG: 7.2,
    });
  });

  it('treats a serving as a whole multiple of the definition', () => {
    expect(calculatePortionNutrition(chickenBreast, 1.5, FoodUnit.SERVING).energyKcal).toBe(247.5);
  });

  it('keeps missing macros missing instead of turning them into zeros', () => {
    const coffee: FoodNutritionDefinition = {
      servingSize: 1,
      servingUnit: FoodUnit.PIECE,
      energyKcal: 60,
      proteinG: null,
      carbsG: null,
      fatG: null,
    };

    expect(calculatePortionNutrition(coffee, 2, FoodUnit.PIECE)).toEqual({
      energyKcal: 120,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  });

  it('refuses to invent a conversion between incompatible units', () => {
    expect(() => calculatePortionNutrition(chickenBreast, 200, FoodUnit.MILLILITER)).toThrow(
      IncompatibleFoodUnitError,
    );
  });
});
