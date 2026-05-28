CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "RelationCase" ADD COLUMN "candidateAccessToken" TEXT;

UPDATE "RelationCase"
SET "candidateAccessToken" =
  replace(gen_random_uuid()::text, '-', '') ||
  replace(gen_random_uuid()::text, '-', '')
WHERE "candidateAccessToken" IS NULL;

ALTER TABLE "RelationCase" ALTER COLUMN "candidateAccessToken" SET NOT NULL;

CREATE UNIQUE INDEX "RelationCase_candidateAccessToken_key"
ON "RelationCase"("candidateAccessToken");
