import { Intensity } from '@prisma/client';

import {
  applyIntensity,
  calculateEnergyFromMet,
  calculateWalkingMet,
  estimateDurationFromRepetitions,
} from './metabolic-equivalent';

describe('calculateEnergyFromMet', () => {
  it('converts MET, body weight and duration into kilocalories', () => {
    expect(calculateEnergyFromMet({ met: 3.33, weightKg: 80, durationSec: 2700 })).toBe(210);
  });

  it('returns zero without a duration', () => {
    expect(calculateEnergyFromMet({ met: 8, weightKg: 80, durationSec: 0 })).toBe(0);
  });

  it('returns zero without a body weight', () => {
    expect(calculateEnergyFromMet({ met: 8, weightKg: 0, durationSec: 1800 })).toBe(0);
  });
});

describe('calculateWalkingMet', () => {
  it('derives MET from treadmill speed', () => {
    expect(calculateWalkingMet(4.9)).toBe(3.33);
  });

  it('increases with incline', () => {
    expect(calculateWalkingMet(5, 5)).toBe(5.52);
    expect(calculateWalkingMet(5, 5)).toBeGreaterThan(calculateWalkingMet(5, 0));
  });

  it('falls back to resting metabolism without movement', () => {
    expect(calculateWalkingMet(0)).toBe(1);
  });
});

describe('applyIntensity', () => {
  it('scales the baseline MET', () => {
    expect(applyIntensity(8, Intensity.HIGH)).toBe(10.4);
    expect(applyIntensity(8, Intensity.LOW)).toBe(6.4);
  });

  it('treats a missing intensity as moderate', () => {
    expect(applyIntensity(8, null)).toBe(8);
  });
});

describe('estimateDurationFromRepetitions', () => {
  it('approximates the time spent on repetitions', () => {
    expect(estimateDurationFromRepetitions(80)).toBe(240);
  });
});
