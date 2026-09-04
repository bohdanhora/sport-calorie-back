-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "nutrition_providers" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "apiKeyCipher" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyTag" TEXT NOT NULL,
    "apiKeyHint" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nutrition_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nutrition_providers_userId_key" ON "nutrition_providers"("userId");

-- AddForeignKey
ALTER TABLE "nutrition_providers" ADD CONSTRAINT "nutrition_providers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

