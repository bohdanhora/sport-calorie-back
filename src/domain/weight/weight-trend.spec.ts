import { calculateWeightSummary, calculateWeightTrendKgPerWeek } from './weight-trend';

describe('calculateWeightTrendKgPerWeek', () => {
  it('reports a steady loss as a negative weekly change', () => {
    const points = [
      { date: '2026-03-01', weightKg: 82 },
      { date: '2026-03-08', weightKg: 81.5 },
      { date: '2026-03-15', weightKg: 81 },
      { date: '2026-03-22', weightKg: 80.5 },
    ];

    expect(calculateWeightTrendKgPerWeek(points)).toBe(-0.5);
  });

  it('reports a flat trend as zero', () => {
    const points = [
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-08', weightKg: 80 },
      { date: '2026-03-15', weightKg: 80 },
    ];

    expect(calculateWeightTrendKgPerWeek(points)).toBe(0);
  });

  it('needs more than two measurements', () => {
    expect(
      calculateWeightTrendKgPerWeek([
        { date: '2026-03-01', weightKg: 82 },
        { date: '2026-03-08', weightKg: 81 },
      ]),
    ).toBeNull();
  });

  it('ignores measurements older than the trend window', () => {
    const points = [
      { date: '2025-01-01', weightKg: 95 },
      { date: '2026-03-01', weightKg: 80 },
      { date: '2026-03-08', weightKg: 80 },
      { date: '2026-03-15', weightKg: 80 },
    ];

    expect(calculateWeightTrendKgPerWeek(points)).toBe(0);
  });
});

describe('calculateWeightSummary', () => {
  it('summarises the whole history', () => {
    expect(
      calculateWeightSummary([
        { date: '2026-03-01', weightKg: 82.4 },
        { date: '2026-03-08', weightKg: 81.6 },
        { date: '2026-03-15', weightKg: 80.9 },
      ]),
    ).toEqual({
      currentWeightKg: 80.9,
      startingWeightKg: 82.4,
      totalChangeKg: -1.5,
      trendKgPerWeek: -0.75,
    });
  });

  it('handles an empty history', () => {
    expect(calculateWeightSummary([])).toEqual({
      currentWeightKg: null,
      startingWeightKg: null,
      totalChangeKg: null,
      trendKgPerWeek: null,
    });
  });
});
