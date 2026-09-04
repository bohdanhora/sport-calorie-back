import { ActivityLevel, FitnessGoal } from '@prisma/client';

import {
  calculateMacroTargets,
  calculateRecommendedCalorieTarget,
  calculateTdee,
} from './calorie-target';

describe('calculateTdee', () => {
  it('scales BMR by the lifestyle activity factor', () => {
    expect(calculateTdee(1780, ActivityLevel.LIGHT)).toBe(2448);
    expect(calculateTdee(1780, ActivityLevel.SEDENTARY)).toBe(2136);
  });
});

describe('calculateRecommendedCalorieTarget', () => {
  it('creates a deficit when the goal is to lose weight', () => {
    expect(calculateRecommendedCalorieTarget(2448, FitnessGoal.LOSE_WEIGHT, 1780)).toBe(2081);
  });

  it('leaves the target at TDEE when maintaining', () => {
    expect(calculateRecommendedCalorieTarget(2448, FitnessGoal.MAINTAIN_WEIGHT, 1780)).toBe(2448);
  });

  it('creates a surplus when the goal is to gain weight', () => {
    expect(calculateRecommendedCalorieTarget(2448, FitnessGoal.GAIN_WEIGHT, 1780)).toBe(2693);
  });

  it('never recommends eating below basal metabolic rate', () => {
    expect(calculateRecommendedCalorieTarget(1500, FitnessGoal.LOSE_WEIGHT, 1780)).toBe(1780);
  });
});

describe('calculateMacroTargets', () => {
  it('anchors protein and fat to body weight and fills the rest with carbohydrates', () => {
    expect(calculateMacroTargets(2000, 80)).toEqual({ proteinG: 144, carbsG: 212, fatG: 64 });
  });

  it('falls back to a percentage split when body weight is unknown', () => {
    expect(calculateMacroTargets(2000, null)).toEqual({ proteinG: 150, carbsG: 200, fatG: 67 });
  });

  it('never returns negative carbohydrates for a very low target', () => {
    const targets = calculateMacroTargets(500, 80);

    expect(targets.carbsG).toBe(0);
    expect(targets.proteinG).toBeLessThan(144);
    expect(targets.fatG).toBeLessThan(64);
  });
});
