-- AlterTable
ALTER TABLE "nutrition_providers" ADD COLUMN     "models" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "modelsFetchedAt" TIMESTAMPTZ(3);
