import { deriveWalkingMetrics } from './walking';

describe('deriveWalkingMetrics', () => {
  it('derives average speed from duration and distance', () => {
    expect(deriveWalkingMetrics({ durationSec: 2700, distanceM: 3700 })).toEqual({
      durationSec: 2700,
      distanceM: 3700,
      avgSpeedKmh: 4.93,
    });
  });

  it('derives distance from duration and speed', () => {
    expect(deriveWalkingMetrics({ durationSec: 2700, avgSpeedKmh: 5 })).toEqual({
      durationSec: 2700,
      distanceM: 3750,
      avgSpeedKmh: 5,
    });
  });

  it('derives duration from distance and speed', () => {
    expect(deriveWalkingMetrics({ distanceM: 3700, avgSpeedKmh: 4.9 })).toEqual({
      durationSec: 2718,
      distanceM: 3700,
      avgSpeedKmh: 4.9,
    });
  });

  it('prefers measured duration and distance over a supplied speed', () => {
    expect(
      deriveWalkingMetrics({ durationSec: 2700, distanceM: 3700, avgSpeedKmh: 9 }).avgSpeedKmh,
    ).toBe(4.93);
  });

  it('keeps a single known value untouched', () => {
    expect(deriveWalkingMetrics({ durationSec: 1800 })).toEqual({
      durationSec: 1800,
      distanceM: null,
      avgSpeedKmh: null,
    });
  });

  it('ignores zero and missing values', () => {
    expect(deriveWalkingMetrics({ durationSec: 0, distanceM: null })).toEqual({
      durationSec: null,
      distanceM: null,
      avgSpeedKmh: null,
    });
  });
});
