import { summariseWalking } from './walking-summary';

describe('summariseWalking', () => {
  it('totals the day and derives the overall average speed', () => {
    expect(
      summariseWalking([
        { durationSec: 2700, distanceM: 3700, energyKcal: 211 },
        { durationSec: 1800, distanceM: 2400, energyKcal: 130 },
      ]),
    ).toEqual({
      sessions: 2,
      distanceM: 6100,
      durationSec: 4500,
      avgSpeedKmh: 4.88,
      energyKcal: 341,
    });
  });

  it('omits the average speed when distance was never recorded', () => {
    expect(summariseWalking([{ durationSec: 1200, distanceM: null, energyKcal: 60 }])).toEqual({
      sessions: 1,
      distanceM: 0,
      durationSec: 1200,
      avgSpeedKmh: null,
      energyKcal: 60,
    });
  });

  it('returns an empty summary for a day without walking', () => {
    expect(summariseWalking([])).toEqual({
      sessions: 0,
      distanceM: 0,
      durationSec: 0,
      avgSpeedKmh: null,
      energyKcal: 0,
    });
  });
});
