CREATE TYPE "RelationStatus" AS ENUM (
  'NEW',
  'WAITING_CANDIDATE',
  'WAITING_OWNER',
  'REVIEWING',
  'VALIDATED',
  'REJECTED',
  'CLOSED'
);

ALTER TABLE "RelationCase"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "RelationCase"
ALTER COLUMN "status" TYPE "RelationStatus"
USING (
  CASE "status"::text
    WHEN 'IN_DISCUSSION' THEN 'REVIEWING'
    WHEN 'REFUSED' THEN 'REJECTED'
    ELSE "status"::text
  END
)::"RelationStatus";

ALTER TABLE "RelationCase"
ALTER COLUMN "status" SET DEFAULT 'NEW';
