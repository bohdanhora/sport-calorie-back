import { ActivityCategory, Intensity } from '@prisma/client';

import { estimateActivityEnergy } from './activity-energy';

describe('estimateActivityEnergy', () => {
  it('uses treadmill speed rather than the catalog MET for walking', () => {
    const estimate = estimateActivityEnergy({
      category: ActivityCategory.WALKING,
      metModerate: 3.5,
      weightKg: 80,
      durationSec: 2700,
      distanceM: 3700,
    });

    expect(estimate.met).toBe(3.35);
    expect(estimate.energyKcal).toBe(211);
    expect(estimate.effectiveDurationSec).toBe(2700);
  });

  it('accounts for incline on the treadmill', () => {
    const flat = estimateActivityEnergy({
      category: ActivityCategory.WALKING,
      metModerate: 3.5,
      weightKg: 80,
      durationSec: 2700,
      avgSpeedKmh: 5,
    });
    const uphill = estimateActivityEnergy({
      category: ActivityCategory.WALKING,
      metModerate: 3.5,
      weightKg: 80,
      durationSec: 2700,
      avgSpeedKmh: 5,
      inclinePercent: 6,
    });

    expect(uphill.energyKcal).toBeGreaterThan(flat.energyKcal);
  });

  it('applies intensity to catalog activities', () => {
    const estimate = estimateActivityEnergy({
      category: ActivityCategory.CARDIO,
      metModerate: 11.8,
      weightKg: 80,
      durationSec: 600,
      intensity: Intensity.MODERATE,
    });

    expect(estimate.met).toBe(11.8);
    expect(estimate.energyKcal).toBe(165);
  });

  it('estimates duration from repetitions when no duration is given', () => {
    const estimate = estimateActivityEnergy({
      category: ActivityCategory.STRENGTH,
      metModerate: 3.8,
      weightKg: 80,
      reps: 80,
    });

    expect(estimate.effectiveDurationSec).toBe(240);
    expect(estimate.energyKcal).toBe(21);
  });

  it('returns zero when there is nothing to measure', () => {
    expect(
      estimateActivityEnergy({
        category: ActivityCategory.OTHER,
        metModerate: 4,
        weightKg: 80,
      }).energyKcal,
    ).toBe(0);
  });
});
