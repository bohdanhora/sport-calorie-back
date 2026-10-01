-- CreateTable
CREATE TABLE "saved_exercises" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activityTypeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "durationSec" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "avgSpeedKmh" DOUBLE PRECISION,
    "inclinePercent" DOUBLE PRECISION,
    "sets" INTEGER,
    "reps" INTEGER,
    "intensity" "Intensity",
    "energyKcal" DOUBLE PRECISION,
    "notes" TEXT,
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saved_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "workoutId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("workoutId","position")
);

-- CreateIndex
CREATE INDEX "saved_exercises_userId_createdAt_idx" ON "saved_exercises"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "workouts_userId_createdAt_idx" ON "workouts"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "workout_exercises_exerciseId_idx" ON "workout_exercises"("exerciseId");

-- AddForeignKey
ALTER TABLE "saved_exercises" ADD CONSTRAINT "saved_exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_exercises" ADD CONSTRAINT "saved_exercises_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "saved_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
