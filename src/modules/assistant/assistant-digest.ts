import type { FoodUnit, MealType } from '@prisma/client';

import { parseLocalDate, type LocalDateString } from '../../common/date/local-date';
import type { DigestScope } from './assistant-scope';

export interface DigestProfile {
  sex: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  goal: string;
  activityLevel: string;
}

export interface DigestDay {
  date: LocalDateString;
  consumedKcal: number;
  targetKcal: number;
  activityKcal: number;
  weightKg: number | null;
}

export interface DigestFood {
  date: LocalDateString;
  time: string | null;
  meal: MealType;
  name: string;
  amount: number;
  unit: FoodUnit;
  energyKcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  notes: string | null;
}

export interface DigestActivity {
  date: LocalDateString;
  time: string | null;
  name: string;
  durationSec: number | null;
  distanceM: number | null;
  energyKcal: number;
}

export interface DigestInput {
  today: LocalDateString;
  from: LocalDateString;
  to: LocalDateString;
  profile: DigestProfile;
  days: DigestDay[];
  foods: DigestFood[];
  activities: DigestActivity[];
  scope: DigestScope;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const UNIT_LABELS: Record<FoodUnit, string> = {
  GRAM: 'g',
  MILLILITER: 'ml',
  PIECE: 'pcs',
  SERVING: 'serving',
};

const SECONDS_PER_MINUTE = 60;
const METRES_PER_KM = 1000;
const FREQUENT_FOODS = 15;
const LARGEST_ENTRIES = 10;

const weekday = (date: LocalDateString): string => WEEKDAYS[parseLocalDate(date).getUTCDay()];

const whole = (value: number): string => String(Math.round(value));

const grams = (value: number | null): string => (value === null ? '?' : whole(value));

const known = (value: number | string | null, suffix = ''): string =>
  value === null ? 'unknown' : `${value}${suffix}`;

const describeProfile = (profile: DigestProfile): string =>
  [
    `sex ${known(profile.sex)}`,
    `age ${known(profile.age)}`,
    `height ${known(profile.heightCm, ' cm')}`,
    `latest weight ${known(profile.weightKg, ' kg')}`,
    `target weight ${known(profile.targetWeightKg, ' kg')}`,
    `goal ${profile.goal}`,
    `activity level ${profile.activityLevel}`,
  ].join(', ');

const describeDay = (day: DigestDay, macros: Map<LocalDateString, number[]>): string => {
  const [protein, carbs, fat] = macros.get(day.date) ?? [0, 0, 0];

  return [
    `${day.date} ${weekday(day.date)}`,
    day.consumedKcal > 0
      ? `${whole(day.consumedKcal)}/${whole(day.targetKcal)} kcal`
      : `nothing logged, target ${whole(day.targetKcal)} kcal`,
    day.consumedKcal > 0 ? `P${whole(protein)} C${whole(carbs)} F${whole(fat)}` : null,
    day.activityKcal > 0 ? `activity ${whole(day.activityKcal)} kcal` : null,
    day.weightKg === null ? null : `weight ${day.weightKg} kg`,
  ]
    .filter(Boolean)
    .join(' | ');
};

const describeFood = (food: DigestFood): string =>
  [
    `${food.date} ${food.time ?? '--:--'} ${food.meal}`,
    food.name,
    `${food.amount} ${UNIT_LABELS[food.unit]}`,
    `${whole(food.energyKcal)} kcal`,
    `P${grams(food.proteinG)} C${grams(food.carbsG)} F${grams(food.fatG)}`,
    food.notes ? `note: ${food.notes}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

const describeActivity = (activity: DigestActivity): string =>
  [
    `${activity.date} ${activity.time ?? '--:--'}`,
    activity.name,
    activity.durationSec ? `${Math.round(activity.durationSec / SECONDS_PER_MINUTE)} min` : null,
    activity.distanceM ? `${(activity.distanceM / METRES_PER_KM).toFixed(1)} km` : null,
    `${whole(activity.energyKcal)} kcal`,
  ]
    .filter(Boolean)
    .join(' | ');

const sumMacros = (foods: DigestFood[]): Map<LocalDateString, number[]> => {
  const totals = new Map<LocalDateString, number[]>();

  for (const food of foods) {
    const [protein, carbs, fat] = totals.get(food.date) ?? [0, 0, 0];

    totals.set(food.date, [
      protein + (food.proteinG ?? 0),
      carbs + (food.carbsG ?? 0),
      fat + (food.fatG ?? 0),
    ]);
  }

  return totals;
};

const FOOD_LOG_COLUMNS = '(date time meal | name | portion | kcal | protein carbs fat in g | note)';

const describeFrequentFoods = (foods: DigestFood[]): string[] => {
  const byName = new Map<string, { name: string; count: number; energyKcal: number }>();

  for (const food of foods) {
    const key = food.name.trim().toLowerCase();
    const seen = byName.get(key) ?? { name: food.name, count: 0, energyKcal: 0 };

    byName.set(key, {
      ...seen,
      count: seen.count + 1,
      energyKcal: seen.energyKcal + food.energyKcal,
    });
  }

  return [...byName.values()]
    .sort((a, b) => b.count - a.count || b.energyKcal - a.energyKcal)
    .slice(0, FREQUENT_FOODS)
    .map(
      (food) => `${food.name} | ${food.count}x | ${whole(food.energyKcal / food.count)} kcal each`,
    );
};

const describeFoodLog = (input: DigestInput): string[] => {
  const { fullLog } = input.scope;

  if (fullLog === 'all') {
    return [
      `Food log ${FOOD_LOG_COLUMNS}:`,
      ...(input.foods.length > 0 ? input.foods.map(describeFood) : ['none']),
    ];
  }

  const largest = [...input.foods]
    .sort((a, b) => b.energyKcal - a.energyKcal)
    .slice(0, LARGEST_ENTRIES);
  const notable = input.foods.filter((food) => fullLog.has(food.date));

  return [
    'Most frequent foods over the whole period (name | times | kcal per entry):',
    ...(input.foods.length > 0 ? describeFrequentFoods(input.foods) : ['none']),
    '',
    `Largest single entries over the whole period ${FOOD_LOG_COLUMNS}:`,
    ...(largest.length > 0 ? largest.map(describeFood) : ['none']),
    '',
    `Food log ${FOOD_LOG_COLUMNS}, only for days more than 10% above target or with eating after 21:00.`,
    'Other days are known only by their totals above; the user can ask about them in detail:',
    ...(notable.length > 0 ? notable.map(describeFood) : ['none']),
  ];
};

export const buildDigest = (input: DigestInput): string => {
  const macros = sumMacros(input.foods);

  return [
    `Today is ${input.today} (${weekday(input.today)}). The data covers ${input.from} to ${input.to}.`,
    `Profile: ${describeProfile(input.profile)}.`,
    '',
    'Days (date weekday | eaten/target kcal | protein carbs fat in g | activity | weight):',
    ...input.days.map((day) => describeDay(day, macros)),
    '',
    ...describeFoodLog(input),
    ...(input.scope.activities
      ? [
          '',
          'Activities (date time | name | duration | distance | kcal):',
          ...(input.activities.length > 0 ? input.activities.map(describeActivity) : ['none']),
        ]
      : []),
  ].join('\n');
};
