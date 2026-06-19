-- AlterTable
ALTER TABLE "AIEvent"
  ADD COLUMN "tokensInput" INTEGER,
  ADD COLUMN "tokensOutput" INTEGER,
  ADD COLUMN "estimatedCostEur" DECIMAL(12, 6),
  ADD COLUMN "latencyMs" INTEGER;
