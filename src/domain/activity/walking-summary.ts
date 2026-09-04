import { round, secondsToHours, METRES_PER_KILOMETRE } from '../units';

export interface WalkingSessionInput {
  durationSec: number | null;
  distanceM: number | null;
  energyKcal: number;
}

export interface WalkingSummary {
  sessions: number;
  distanceM: number;
  durationSec: number;
  avgSpeedKmh: number | null;
  energyKcal: number;
}

export const EMPTY_WALKING_SUMMARY: WalkingSummary = {
  sessions: 0,
  distanceM: 0,
  durationSec: 0,
  avgSpeedKmh: null,
  energyKcal: 0,
};

export const summariseWalking = (sessions: readonly WalkingSessionInput[]): WalkingSummary => {
  if (sessions.length === 0) {
    return { ...EMPTY_WALKING_SUMMARY };
  }

  const distanceM = sessions.reduce((total, session) => total + (session.distanceM ?? 0), 0);
  const durationSec = sessions.reduce((total, session) => total + (session.durationSec ?? 0), 0);
  const energyKcal = sessions.reduce((total, session) => total + session.energyKcal, 0);

  return {
    sessions: sessions.length,
    distanceM: round(distanceM),
    durationSec,
    avgSpeedKmh:
      distanceM > 0 && durationSec > 0
        ? round(distanceM / METRES_PER_KILOMETRE / secondsToHours(durationSec), 2)
        : null,
    energyKcal: round(energyKcal),
  };
};
