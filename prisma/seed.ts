import {
  ActivityCategory,
  ActivityLevel,
  BiologicalSex,
  EnergySource,
  FitnessGoal,
  FoodUnit,
  Intensity,
  MealType,
  PrismaClient,
  type ActivityType,
  type Food,
  type Prisma,
} from '@prisma/client';
import { hash } from 'bcrypt';

import {
  addLocalDays,
  instantForLocalDate,
  parseLocalDate,
  todayInTimeZone,
  zonedTimeToInstant,
} from '../src/common/date/local-date';
import {
  calculatePortionNutrition,
  deriveWalkingMetrics,
  estimateActivityEnergy,
  round,
} from '../src/domain';

const prisma = new PrismaClient();

const PASSWORD_SALT_ROUNDS = 12;
const DEMO_HISTORY_DAYS = 30;

interface ActivityTypeSeed {
  slug: string;
  name: string;
  category: ActivityCategory;
  metModerate: number;
  sortOrder: number;
  tracksDistance?: boolean;
  tracksIncline?: boolean;
  tracksReps?: boolean;
  tracksSets?: boolean;
}

const ACTIVITY_TYPES: ActivityTypeSeed[] = [
  {
    slug: 'walking',
    name: 'Walking',
    category: ActivityCategory.WALKING,
    metModerate: 3.5,
    sortOrder: 10,
    tracksDistance: true,
  },
  {
    slug: 'treadmill',
    name: 'Treadmill',
    category: ActivityCategory.WALKING,
    metModerate: 4.3,
    sortOrder: 20,
    tracksDistance: true,
    tracksIncline: true,
  },
  {
    slug: 'running',
    name: 'Running',
    category: ActivityCategory.CARDIO,
    metModerate: 9.8,
    sortOrder: 30,
    tracksDistance: true,
    tracksIncline: true,
  },
  {
    slug: 'cycling',
    name: 'Cycling',
    category: ActivityCategory.CARDIO,
    metModerate: 7.5,
    sortOrder: 40,
    tracksDistance: true,
  },
  {
    slug: 'jump-rope',
    name: 'Jump rope',
    category: ActivityCategory.CARDIO,
    metModerate: 11.8,
    sortOrder: 50,
  },
  {
    slug: 'push-ups',
    name: 'Push-ups',
    category: ActivityCategory.STRENGTH,
    metModerate: 3.8,
    sortOrder: 60,
    tracksReps: true,
    tracksSets: true,
  },
  {
    slug: 'squats',
    name: 'Squats',
    category: ActivityCategory.STRENGTH,
    metModerate: 5,
    sortOrder: 70,
    tracksReps: true,
    tracksSets: true,
  },
  {
    slug: 'strength-training',
    name: 'Strength training',
    category: ActivityCategory.STRENGTH,
    metModerate: 5,
    sortOrder: 80,
    tracksReps: true,
    tracksSets: true,
  },
  {
    slug: 'stretching',
    name: 'Stretching',
    category: ActivityCategory.MOBILITY,
    metModerate: 2.3,
    sortOrder: 90,
  },
  {
    slug: 'other',
    name: 'Other',
    category: ActivityCategory.OTHER,
    metModerate: 4,
    sortOrder: 100,
    tracksDistance: true,
    tracksReps: true,
    tracksSets: true,
  },
];

interface FoodSeed {
  name: string;
  servingSize: number;
  servingUnit: FoodUnit;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const FOODS: FoodSeed[] = [
  {
    name: 'Chicken breast',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
  },
  {
    name: 'Salmon fillet',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 208,
    proteinG: 20,
    carbsG: 0,
    fatG: 13,
  },
  {
    name: 'Rice, cooked',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 130,
    proteinG: 2.7,
    carbsG: 28,
    fatG: 0.3,
  },
  {
    name: 'Buckwheat, cooked',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 92,
    proteinG: 3.4,
    carbsG: 19.9,
    fatG: 0.6,
  },
  {
    name: 'Oats',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 389,
    proteinG: 16.9,
    carbsG: 66.3,
    fatG: 6.9,
  },
  {
    name: 'Whole grain bread',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 247,
    proteinG: 13,
    carbsG: 41,
    fatG: 3.4,
  },
  {
    name: 'Greek yogurt',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 59,
    proteinG: 10,
    carbsG: 3.6,
    fatG: 0.4,
  },
  {
    name: 'Cottage cheese',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 98,
    proteinG: 11,
    carbsG: 3.4,
    fatG: 4.3,
  },
  {
    name: 'Almonds',
    servingSize: 100,
    servingUnit: FoodUnit.GRAM,
    energyKcal: 579,
    proteinG: 21,
    carbsG: 22,
    fatG: 50,
  },
  {
    name: 'Olive oil',
    servingSize: 100,
    servingUnit: FoodUnit.MILLILITER,
    energyKcal: 884,
    proteinG: 0,
    carbsG: 0,
    fatG: 100,
  },
  {
    name: 'Milk 2.5%',
    servingSize: 100,
    servingUnit: FoodUnit.MILLILITER,
    energyKcal: 52,
    proteinG: 3.3,
    carbsG: 4.8,
    fatG: 2.5,
  },
  {
    name: 'Egg',
    servingSize: 1,
    servingUnit: FoodUnit.PIECE,
    energyKcal: 78,
    proteinG: 6.3,
    carbsG: 0.6,
    fatG: 5.3,
  },
  {
    name: 'Banana',
    servingSize: 1,
    servingUnit: FoodUnit.PIECE,
    energyKcal: 105,
    proteinG: 1.3,
    carbsG: 27,
    fatG: 0.4,
  },
  {
    name: 'Apple',
    servingSize: 1,
    servingUnit: FoodUnit.PIECE,
    energyKcal: 95,
    proteinG: 0.5,
    carbsG: 25,
    fatG: 0.3,
  },
  {
    name: 'Protein shake',
    servingSize: 1,
    servingUnit: FoodUnit.SERVING,
    energyKcal: 120,
    proteinG: 24,
    carbsG: 3,
    fatG: 1.5,
  },
  {
    name: 'Coffee with milk',
    servingSize: 1,
    servingUnit: FoodUnit.SERVING,
    energyKcal: 40,
    proteinG: 2,
    carbsG: 3,
    fatG: 2,
  },
];

const seedActivityTypes = async (): Promise<Map<string, ActivityType>> => {
  const types = new Map<string, ActivityType>();

  for (const seed of ACTIVITY_TYPES) {
    const data = {
      name: seed.name,
      category: seed.category,
      metModerate: seed.metModerate,
      sortOrder: seed.sortOrder,
      tracksDuration: true,
      tracksDistance: seed.tracksDistance ?? false,
      tracksIncline: seed.tracksIncline ?? false,
      tracksReps: seed.tracksReps ?? false,
      tracksSets: seed.tracksSets ?? false,
      tracksIntensity: true,
    };

    const existing = await prisma.activityType.findFirst({
      where: { userId: null, slug: seed.slug },
    });

    const type = existing
      ? await prisma.activityType.update({ where: { id: existing.id }, data })
      : await prisma.activityType.create({ data: { ...data, slug: seed.slug, userId: null } });

    types.set(seed.slug, type);
  }

  return types;
};

const seedCatalogFoods = async (): Promise<Map<string, Food>> => {
  const foods = new Map<string, Food>();

  for (const seed of FOODS) {
    const existing = await prisma.food.findFirst({ where: { userId: null, name: seed.name } });

    const food = existing
      ? await prisma.food.update({ where: { id: existing.id }, data: seed })
      : await prisma.food.create({ data: { ...seed, userId: null } });

    foods.set(seed.name, food);
  }

  return foods;
};

interface DemoConfig {
  email: string;
  password: string;
  timezone: string;
}

const buildFoodEntry = (
  userId: string,
  food: Food,
  amount: number,
  meal: MealType,
  date: string,
  timezone: string,
  hour: number,
): Prisma.FoodEntryCreateManyInput => {
  const nutrition = calculatePortionNutrition(food, amount, food.servingUnit);

  return {
    userId,
    foodId: food.id,
    name: food.name,
    meal,
    amount,
    unit: food.servingUnit,
    energyKcal: nutrition.energyKcal,
    proteinG: nutrition.proteinG,
    carbsG: nutrition.carbsG,
    fatG: nutrition.fatG,
    consumedAt: zonedTimeToInstant(date, timezone, hour),
    localDate: parseLocalDate(date),
  };
};

const seedDemoUser = async (
  config: DemoConfig,
  activityTypes: Map<string, ActivityType>,
  foods: Map<string, Food>,
): Promise<void> => {
  const existing = await prisma.user.findUnique({ where: { email: config.email } });

  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: {
      email: config.email,
      passwordHash: await hash(config.password, PASSWORD_SALT_ROUNDS),
      profile: {
        create: {
          displayName: 'Demo',
          sex: BiologicalSex.MALE,
          birthDate: parseLocalDate('1994-06-15'),
          heightCm: 182,
          targetWeightKg: 76,
          activityLevel: ActivityLevel.LIGHT,
          goal: FitnessGoal.LOSE_WEIGHT,
          timezone: config.timezone,
        },
      },
    },
  });

  const today = todayInTimeZone(config.timezone);
  const foodEntries: Prisma.FoodEntryCreateManyInput[] = [];
  const activityEntries: Prisma.ActivityEntryCreateManyInput[] = [];
  const weightEntries: Prisma.WeightEntryCreateManyInput[] = [];

  const treadmill = activityTypes.get('treadmill') as ActivityType;
  const jumpRope = activityTypes.get('jump-rope') as ActivityType;
  const pushUps = activityTypes.get('push-ups') as ActivityType;

  for (let offset = DEMO_HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addLocalDays(today, -offset);
    const dayIndex = DEMO_HISTORY_DAYS - 1 - offset;
    const weightKg = round(82.4 - dayIndex * 0.07, 1);

    if (dayIndex % 2 === 0) {
      weightEntries.push({
        userId: user.id,
        date: parseLocalDate(date),
        weightKg,
        recordedAt: zonedTimeToInstant(date, config.timezone, 7),
      });
    }

    foodEntries.push(
      buildFoodEntry(
        user.id,
        foods.get('Oats') as Food,
        60,
        MealType.BREAKFAST,
        date,
        config.timezone,
        8,
      ),
      buildFoodEntry(
        user.id,
        foods.get('Milk 2.5%') as Food,
        200,
        MealType.BREAKFAST,
        date,
        config.timezone,
        8,
      ),
      buildFoodEntry(
        user.id,
        foods.get('Banana') as Food,
        1,
        MealType.BREAKFAST,
        date,
        config.timezone,
        8,
      ),
      buildFoodEntry(
        user.id,
        foods.get('Chicken breast') as Food,
        180,
        MealType.LUNCH,
        date,
        config.timezone,
        13,
      ),
      buildFoodEntry(
        user.id,
        foods.get(dayIndex % 2 === 0 ? 'Rice, cooked' : 'Buckwheat, cooked') as Food,
        200,
        MealType.LUNCH,
        date,
        config.timezone,
        13,
      ),
      buildFoodEntry(
        user.id,
        foods.get(dayIndex % 3 === 0 ? 'Salmon fillet' : 'Cottage cheese') as Food,
        150,
        MealType.DINNER,
        date,
        config.timezone,
        19,
      ),
      buildFoodEntry(
        user.id,
        foods.get('Whole grain bread') as Food,
        60,
        MealType.DINNER,
        date,
        config.timezone,
        19,
      ),
      buildFoodEntry(
        user.id,
        foods.get(dayIndex % 2 === 0 ? 'Greek yogurt' : 'Almonds') as Food,
        dayIndex % 2 === 0 ? 150 : 25,
        MealType.SNACK,
        date,
        config.timezone,
        16,
      ),
      buildFoodEntry(
        user.id,
        foods.get('Coffee with milk') as Food,
        2,
        MealType.SNACK,
        date,
        config.timezone,
        10,
      ),
    );

    if (dayIndex % 7 !== 6) {
      const durationSec = 2100 + (dayIndex % 5) * 300;
      const avgSpeedKmh = round(4.6 + (dayIndex % 4) * 0.2, 1);
      const metrics = deriveWalkingMetrics({ durationSec, avgSpeedKmh });
      const estimate = estimateActivityEnergy({
        category: treadmill.category,
        metModerate: treadmill.metModerate,
        weightKg,
        durationSec: metrics.durationSec,
        distanceM: metrics.distanceM,
        avgSpeedKmh: metrics.avgSpeedKmh,
        inclinePercent: dayIndex % 3 === 0 ? 3 : 0,
      });

      activityEntries.push({
        userId: user.id,
        activityTypeId: treadmill.id,
        title: 'WalkingPad',
        durationSec: metrics.durationSec,
        distanceM: metrics.distanceM,
        avgSpeedKmh: metrics.avgSpeedKmh,
        inclinePercent: dayIndex % 3 === 0 ? 3 : null,
        energyKcal: estimate.energyKcal,
        energySource: EnergySource.ESTIMATED,
        performedAt: zonedTimeToInstant(date, config.timezone, 18),
        localDate: parseLocalDate(date),
      });
    }

    if (dayIndex % 3 === 0) {
      const estimate = estimateActivityEnergy({
        category: jumpRope.category,
        metModerate: jumpRope.metModerate,
        weightKg,
        durationSec: 600,
        intensity: Intensity.MODERATE,
      });

      activityEntries.push({
        userId: user.id,
        activityTypeId: jumpRope.id,
        durationSec: 600,
        intensity: Intensity.MODERATE,
        energyKcal: estimate.energyKcal,
        energySource: EnergySource.ESTIMATED,
        performedAt: zonedTimeToInstant(date, config.timezone, 20),
        localDate: parseLocalDate(date),
      });
    }

    if (dayIndex % 4 === 0) {
      const estimate = estimateActivityEnergy({
        category: pushUps.category,
        metModerate: pushUps.metModerate,
        weightKg,
        reps: 80,
        intensity: Intensity.HIGH,
      });

      activityEntries.push({
        userId: user.id,
        activityTypeId: pushUps.id,
        sets: 5,
        reps: 80,
        durationSec: estimate.effectiveDurationSec,
        intensity: Intensity.HIGH,
        energyKcal: estimate.energyKcal,
        energySource: EnergySource.ESTIMATED,
        performedAt: zonedTimeToInstant(date, config.timezone, 20),
        localDate: parseLocalDate(date),
      });
    }
  }

  await prisma.foodEntry.createMany({ data: foodEntries });
  await prisma.activityEntry.createMany({ data: activityEntries });
  await prisma.weightEntry.createMany({ data: weightEntries });

  const usageCounts = foodEntries.reduce<Map<string, number>>((counts, entry) => {
    const foodId = entry.foodId as string;

    return counts.set(foodId, (counts.get(foodId) ?? 0) + 1);
  }, new Map());

  await prisma.foodUsage.createMany({
    data: [...usageCounts].map(([foodId, usageCount]) => ({
      userId: user.id,
      foodId,
      usageCount,
      lastUsedAt: instantForLocalDate(today, config.timezone),
    })),
  });
};

const main = async (): Promise<void> => {
  const activityTypes = await seedActivityTypes();
  const foods = await seedCatalogFoods();

  process.stdout.write(
    `Seeded ${activityTypes.size} activity types and ${foods.size} catalog foods\n`,
  );

  if (process.env.SEED_DEMO_USER !== 'true') {
    return;
  }

  const config: DemoConfig = {
    email: process.env.SEED_DEMO_EMAIL ?? 'demo@sport-calorie.local',
    password: process.env.SEED_DEMO_PASSWORD ?? 'demo12345',
    timezone: process.env.SEED_DEMO_TIMEZONE ?? 'UTC',
  };

  await seedDemoUser(config, activityTypes, foods);

  process.stdout.write(
    `Seeded demo account ${config.email} with ${DEMO_HISTORY_DAYS} days of history\n`,
  );
};

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    process.stderr.write(`${String(error)}\n`);
  })
  .finally(() => prisma.$disconnect());
