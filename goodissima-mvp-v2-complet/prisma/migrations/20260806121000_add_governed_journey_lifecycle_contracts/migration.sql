DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "GovernedJourneyEvent"
    WHERE "type" <> 'CREATED'
  ) THEN
    RAISE EXCEPTION 'GJ-1 migration aborted: pre-existing events other than CREATED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "GovernedJourney" j
    LEFT JOIN "GovernedJourneyEvent" e
      ON e."governedJourneyId" = j."id"
     AND e."relationCaseId" = j."relationCaseId"
     AND e."type" = 'CREATED'
    GROUP BY j."id", j."relationCaseId"
    HAVING COUNT(e."id") <> 1
  ) THEN
    RAISE EXCEPTION 'GJ-1 migration aborted: each journey must have exactly one CREATED event';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "GovernedJourneyEvent" e
    JOIN "GovernedJourney" j
      ON j."id" = e."governedJourneyId"
    WHERE e."relationCaseId" <> j."relationCaseId"
       OR e."actorUserId" <> j."authorityUserId"
  ) THEN
    RAISE EXCEPTION 'GJ-1 migration aborted: CREATED event case or actor is inconsistent with journey authority';
  END IF;
END
$$;

ALTER TABLE "GovernedJourney" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "GovernedJourneyEvent"
  ADD COLUMN "authorityUserId" TEXT,
  ADD COLUMN "fromStatus" "GovernedJourneyStatus",
  ADD COLUMN "toStatus" "GovernedJourneyStatus",
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "sequence" INTEGER;

-- These values describe CREATED rows that already exist explicitly. No journey
-- or missing transition is reconstructed by this migration.
UPDATE "GovernedJourneyEvent"
SET
  "authorityUserId" = "actorUserId",
  "fromStatus" = NULL,
  "toStatus" = 'DRAFT',
  "sequence" = 1
WHERE "type" = 'CREATED';

ALTER TABLE "GovernedJourneyEvent"
  ALTER COLUMN "authorityUserId" SET NOT NULL,
  ALTER COLUMN "toStatus" SET NOT NULL,
  ALTER COLUMN "sequence" SET NOT NULL;

ALTER TABLE "GovernedJourneyEvent" ADD CONSTRAINT "GovernedJourneyEvent_reason_length_check"
  CHECK ("reason" IS NULL OR length(btrim("reason")) BETWEEN 1 AND 500);

ALTER TABLE "GovernedJourneyEvent" ADD CONSTRAINT "GovernedJourneyEvent_sequence_check"
  CHECK ("sequence" >= 1);

ALTER TABLE "GovernedJourneyEvent" ADD CONSTRAINT "GovernedJourneyEvent_transition_check" CHECK (
  (
    "type" = 'CREATED'
    AND "fromStatus" IS NULL
    AND "toStatus" = 'DRAFT'
    AND "sequence" = 1
  )
  OR
  (
    "type" <> 'CREATED'
    AND "fromStatus" IS NOT NULL
    AND "sequence" > 1
    AND (
      ("type" = 'ACTIVATED' AND "fromStatus" = 'DRAFT' AND "toStatus" = 'ACTIVE')
      OR ("type" = 'SUSPENDED' AND "fromStatus" = 'ACTIVE' AND "toStatus" = 'SUSPENDED' AND "reason" IS NOT NULL AND length(btrim("reason")) BETWEEN 1 AND 500)
      OR ("type" = 'RESUMED' AND "fromStatus" = 'SUSPENDED' AND "toStatus" = 'ACTIVE')
      OR ("type" = 'CLOSED' AND "fromStatus" = 'ACTIVE' AND "toStatus" = 'CLOSED')
      OR ("type" = 'CANCELLED' AND "fromStatus" IN ('DRAFT', 'ACTIVE', 'SUSPENDED') AND "toStatus" = 'CANCELLED' AND "reason" IS NOT NULL AND length(btrim("reason")) BETWEEN 1 AND 500)
    )
  )
);

ALTER TABLE "GovernedJourneyEvent" DROP CONSTRAINT "GovernedJourneyEvent_governedJourneyId_relationCaseId_fkey";

CREATE UNIQUE INDEX "GovernedJourney_id_relationCaseId_authorityUserId_key"
  ON "GovernedJourney"("id", "relationCaseId", "authorityUserId");
CREATE INDEX "GovernedJourney_relationCaseId_status_updatedAt_idx"
  ON "GovernedJourney"("relationCaseId", "status", "updatedAt");
CREATE UNIQUE INDEX "GovernedJourneyEvent_governedJourneyId_sequence_key"
  ON "GovernedJourneyEvent"("governedJourneyId", "sequence");

ALTER TABLE "GovernedJourneyEvent"
  ADD CONSTRAINT "GovernedJourneyEvent_governedJourneyId_relationCaseId_authorityUserId_fkey"
  FOREIGN KEY ("governedJourneyId", "relationCaseId", "authorityUserId")
  REFERENCES "GovernedJourney"("id", "relationCaseId", "authorityUserId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "reject_governed_journey_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'GovernedJourneyEvent is append-only';
END;
$$;

CREATE TRIGGER "GovernedJourneyEvent_append_only"
BEFORE UPDATE OR DELETE ON "GovernedJourneyEvent"
FOR EACH ROW
EXECUTE FUNCTION "reject_governed_journey_event_mutation"();
