-- R1-A establishes one technical GovernedJourney extension per operational
-- RelationTemplate. It creates no extension and performs no historical match.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "GovernedJourney"
    GROUP BY "relationTemplateId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'R1-A migration aborted: duplicate GovernedJourney relationTemplateId values require human reconciliation';
  END IF;
END
$$;

DROP INDEX "GovernedJourney_relationTemplateId_idx";
CREATE UNIQUE INDEX "GovernedJourney_relationTemplateId_key"
  ON "GovernedJourney"("relationTemplateId");

ALTER TABLE "GovernedJourney"
  DROP CONSTRAINT "GovernedJourney_relationCaseId_authorityUserId_fkey";

ALTER TABLE "GovernedJourney"
  ALTER COLUMN "relationCaseId" DROP NOT NULL;

ALTER TABLE "GovernedJourney"
  ADD CONSTRAINT "GovernedJourney_relationCaseId_fkey"
  FOREIGN KEY ("relationCaseId")
  REFERENCES "RelationCase"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- GovernedJourney_authorityUserId_fkey remains unchanged and directly binds
-- the required authorityUserId to User(id) with RESTRICT semantics.
-- GovernedJourneyEvent remains case-scoped during R1-A; its append-only
-- trigger, transition constraints, sequence and composite FK are unchanged.
-- RLS remains enabled on GovernedJourney and GovernedJourneyEvent.
