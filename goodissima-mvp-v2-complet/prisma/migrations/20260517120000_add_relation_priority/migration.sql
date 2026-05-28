CREATE TYPE "RelationPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "RelationCase"
ADD COLUMN "priority" "RelationPriority" NOT NULL DEFAULT 'NORMAL';
