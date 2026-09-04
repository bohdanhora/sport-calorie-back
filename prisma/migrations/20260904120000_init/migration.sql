-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BiologicalSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "FitnessGoal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN_WEIGHT', 'GAIN_WEIGHT');

-- CreateEnum
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('MANUAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "FoodUnit" AS ENUM ('GRAM', 'MILLILITER', 'PIECE', 'SERVING');

-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('WALKING', 'CARDIO', 'STRENGTH', 'MOBILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "Intensity" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "EnergySource" AS ENUM ('ESTIMATED', 'MANUAL');

-- CreateEnum
CREATE TYPE "CalorieTargetSource" AS ENUM ('RECOMMENDED', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT,
    "sex" "BiologicalSex",
    "birthDate" DATE,
    "heightCm" DOUBLE PRECISION,
    "targetWeightKg" DOUBLE PRECISION,
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'LIGHT',
    "goal" "FitnessGoal" NOT NULL DEFAULT 'MAINTAIN_WEIGHT',
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "manualCalorieTargetKcal" DOUBLE PRECISION,
    "manualProteinTargetG" DOUBLE PRECISION,
    "manualCarbsTargetG" DOUBLE PRECISION,
    "manualFatTargetG" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_goals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "calorieTargetKcal" DOUBLE PRECISION NOT NULL,
    "proteinTargetG" DOUBLE PRECISION,
    "carbsTargetG" DOUBLE PRECISION,
    "fatTargetG" DOUBLE PRECISION,
    "source" "CalorieTargetSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foods" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "servingSize" DOUBLE PRECISION NOT NULL,
    "servingUnit" "FoodUnit" NOT NULL DEFAULT 'GRAM',
    "energyKcal" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "source" "FoodSource" NOT NULL DEFAULT 'MANUAL',
    "externalSource" TEXT,
    "externalId" TEXT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "foods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_usages" (
    "userId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_usages_pkey" PRIMARY KEY ("userId","foodId")
);

-- CreateTable
CREATE TABLE "food_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "foodId" UUID,
    "name" TEXT NOT NULL,
    "meal" "MealType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" "FoodUnit" NOT NULL DEFAULT 'GRAM',
    "energyKcal" DOUBLE PRECISION NOT NULL,
    "proteinG" DOUBLE PRECISION,
    "carbsG" DOUBLE PRECISION,
    "fatG" DOUBLE PRECISION,
    "notes" TEXT,
    "consumedAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "food_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_types" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ActivityCategory" NOT NULL,
    "metModerate" DOUBLE PRECISION NOT NULL,
    "tracksDuration" BOOLEAN NOT NULL DEFAULT true,
    "tracksDistance" BOOLEAN NOT NULL DEFAULT false,
    "tracksIncline" BOOLEAN NOT NULL DEFAULT false,
    "tracksReps" BOOLEAN NOT NULL DEFAULT false,
    "tracksSets" BOOLEAN NOT NULL DEFAULT false,
    "tracksIntensity" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activityTypeId" UUID NOT NULL,
    "title" TEXT,
    "durationSec" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "avgSpeedKmh" DOUBLE PRECISION,
    "inclinePercent" DOUBLE PRECISION,
    "sets" INTEGER,
    "reps" INTEGER,
    "intensity" "Intensity",
    "energyKcal" DOUBLE PRECISION NOT NULL,
    "energySource" "EnergySource" NOT NULL DEFAULT 'ESTIMATED',
    "notes" TEXT,
    "performedAt" TIMESTAMPTZ(3) NOT NULL,
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "weight_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_goals_userId_date_key" ON "daily_goals"("userId", "date");

-- CreateIndex
CREATE INDEX "foods_userId_name_idx" ON "foods"("userId", "name");

-- CreateIndex
CREATE INDEX "foods_externalSource_externalId_idx" ON "foods"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "food_usages_userId_lastUsedAt_idx" ON "food_usages"("userId", "lastUsedAt" DESC);

-- CreateIndex
CREATE INDEX "food_entries_userId_localDate_idx" ON "food_entries"("userId", "localDate");

-- CreateIndex
CREATE INDEX "food_entries_userId_localDate_meal_idx" ON "food_entries"("userId", "localDate", "meal");

-- CreateIndex
CREATE INDEX "activity_types_category_sortOrder_idx" ON "activity_types"("category", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "activity_types_userId_slug_key" ON "activity_types"("userId", "slug");

-- CreateIndex
CREATE INDEX "activity_entries_userId_localDate_idx" ON "activity_entries"("userId", "localDate");

-- CreateIndex
CREATE INDEX "activity_entries_userId_activityTypeId_localDate_idx" ON "activity_entries"("userId", "activityTypeId", "localDate");

-- CreateIndex
CREATE INDEX "weight_entries_userId_date_idx" ON "weight_entries"("userId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "weight_entries_userId_date_key" ON "weight_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_goals" ADD CONSTRAINT "daily_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foods" ADD CONSTRAINT "foods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_usages" ADD CONSTRAINT "food_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_usages" ADD CONSTRAINT "food_usages_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "foods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

