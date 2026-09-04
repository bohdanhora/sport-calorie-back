import { calculateCalorieBalance } from './calorie-balance';

describe('calculateCalorieBalance', () => {
  it('credits logged activity back to the day allowance', () => {
    expect(
      calculateCalorieBalance({ targetKcal: 2000, consumedKcal: 1650, activityKcal: 420 }),
    ).toEqual({
      targetKcal: 2000,
      consumedKcal: 1650,
      activityKcal: 420,
      netKcal: 1230,
      remainingKcal: 770,
      balanceKcal: -770,
      targetProgress: 0.825,
    });
  });

  it('reports a surplus when the target is exceeded', () => {
    const balance = calculateCalorieBalance({
      targetKcal: 2000,
      consumedKcal: 2500,
      activityKcal: 0,
    });

    expect(balance.remainingKcal).toBe(-500);
    expect(balance.balanceKcal).toBe(500);
    expect(balance.targetProgress).toBe(1.25);
  });

  it('does not divide by zero when no target is set', () => {
    expect(
      calculateCalorieBalance({ targetKcal: 0, consumedKcal: 800, activityKcal: 0 }).targetProgress,
    ).toBe(0);
  });
});
