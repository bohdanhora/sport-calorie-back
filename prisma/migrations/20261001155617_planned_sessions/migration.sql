-- AlterTable
ALTER TABLE "activity_entries" ADD COLUMN     "plannedSessionId" UUID;

-- CreateTable
CREATE TABLE "planned_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "workoutId" UUID,
    "exerciseId" UUID,
    "activityTypeId" UUID,
    "name" TEXT,
    "durationSec" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "avgSpeedKmh" DOUBLE PRECISION,
    "inclinePercent" DOUBLE PRECISION,
    "sets" INTEGER,
    "reps" INTEGER,
    "intensity" "Intensity",
    "energyKcal" DOUBLE PRECISION,
    "notes" TEXT,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "planned_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "planned_sessions_userId_localDate_idx" ON "planned_sessions"("userId", "localDate");

-- CreateIndex
CREATE INDEX "activity_entries_plannedSessionId_idx" ON "activity_entries"("plannedSessionId");

-- AddForeignKey
ALTER TABLE "activity_entries" ADD CONSTRAINT "activity_entries_plannedSessionId_fkey" FOREIGN KEY ("plannedSessionId") REFERENCES "planned_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "saved_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "activity_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
