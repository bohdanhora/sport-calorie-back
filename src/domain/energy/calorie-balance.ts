import { round } from '../units';

export interface CalorieBalanceInput {
  targetKcal: number;
  consumedKcal: number;
  activityKcal: number;
}

export interface CalorieBalance {
  targetKcal: number;
  consumedKcal: number;
  activityKcal: number;
  netKcal: number;
  remainingKcal: number;
  balanceKcal: number;
  targetProgress: number;
}

export const calculateCalorieBalance = ({
  targetKcal,
  consumedKcal,
  activityKcal,
}: CalorieBalanceInput): CalorieBalance => {
  const netKcal = consumedKcal - activityKcal;

  return {
    targetKcal: round(targetKcal),
    consumedKcal: round(consumedKcal),
    activityKcal: round(activityKcal),
    netKcal: round(netKcal),
    remainingKcal: round(targetKcal + activityKcal - consumedKcal),
    balanceKcal: round(netKcal - targetKcal),
    targetProgress: targetKcal > 0 ? round(consumedKcal / targetKcal, 4) : 0,
  };
};
