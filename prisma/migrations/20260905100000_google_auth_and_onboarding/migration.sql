-- AlterTable
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleId" TEXT;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "onboardingCompletedAt" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- Accounts that already carry the body data onboarding asks for have answered it
-- and must not be sent through the wizard.
UPDATE "user_profiles"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE "sex" IS NOT NULL
  AND "birthDate" IS NOT NULL
  AND "heightCm" IS NOT NULL;
