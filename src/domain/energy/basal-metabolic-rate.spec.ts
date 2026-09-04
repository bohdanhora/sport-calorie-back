import { BiologicalSex } from '@prisma/client';

import { calculateAgeYears, calculateBmr } from './basal-metabolic-rate';

describe('calculateBmr', () => {
  it('applies the Mifflin-St Jeor formula for men', () => {
    expect(
      calculateBmr({ sex: BiologicalSex.MALE, weightKg: 80, heightCm: 180, ageYears: 30 }),
    ).toBe(1780);
  });

  it('applies the Mifflin-St Jeor formula for women', () => {
    expect(
      calculateBmr({ sex: BiologicalSex.FEMALE, weightKg: 65, heightCm: 165, ageYears: 28 }),
    ).toBe(1380);
  });

  it('never returns an implausibly low value', () => {
    expect(
      calculateBmr({ sex: BiologicalSex.FEMALE, weightKg: 30, heightCm: 120, ageYears: 90 }),
    ).toBe(800);
  });
});

describe('calculateAgeYears', () => {
  it('counts whole years only', () => {
    expect(
      calculateAgeYears(new Date('1994-06-15T00:00:00Z'), new Date('2026-06-14T00:00:00Z')),
    ).toBe(31);
    expect(
      calculateAgeYears(new Date('1994-06-15T00:00:00Z'), new Date('2026-06-15T00:00:00Z')),
    ).toBe(32);
  });

  it('never returns a negative age', () => {
    expect(
      calculateAgeYears(new Date('2030-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z')),
    ).toBe(0);
  });
});
