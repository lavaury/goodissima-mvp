-- M1 only: expand event scope to case-less Journeys. No historical rows are changed.
-- R1 (reconcile missing CREATED events) and M2 (require CREATED at commit) are separate.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "GovernedJourneyEvent" e
    LEFT JOIN "GovernedJourney" j ON j.id = e."governedJourneyId"
    WHERE j.id IS NULL
       OR e."authorityUserId" IS DISTINCT FROM j."authorityUserId"
       OR e."relationCaseId" IS DISTINCT FROM j."relationCaseId"
  ) THEN
    RAISE EXCEPTION 'M1 preflight: inconsistent Journey events';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "GovernedMemorySource" s
    LEFT JOIN "GovernedJourneyEvent" e ON e.id = s."governedJourneyEventId"
    WHERE s."governedJourneyEventId" IS NOT NULL
      AND (s."governedJourneyId" IS NULL OR e.id IS NULL
        OR s."governedJourneyId" IS DISTINCT FROM e."governedJourneyId"
        OR s."relationCaseId" IS DISTINCT FROM e."relationCaseId")
  ) THEN
    RAISE EXCEPTION 'M1 preflight: inconsistent Journey event provenance';
  END IF;
END;
$$;

CREATE UNIQUE INDEX "GovernedJourney_id_authorityUserId_key"
  ON "GovernedJourney"("id", "authorityUserId");
CREATE UNIQUE INDEX "GovernedJourneyEvent_id_governedJourneyId_key"
  ON "GovernedJourneyEvent"("id", "governedJourneyId");

ALTER TABLE "GovernedMemorySource"
  DROP CONSTRAINT "GovernedMemorySource_governedJourneyEventId_governedJourneyId_relationCaseId_fkey";
ALTER TABLE "GovernedJourneyEvent"
  DROP CONSTRAINT "GovernedJourneyEvent_governedJourneyId_relationCaseId_authorityUserId_fkey";

ALTER TABLE "GovernedJourneyEvent" ALTER COLUMN "relationCaseId" DROP NOT NULL;

ALTER TABLE "GovernedJourneyEvent"
  ADD CONSTRAINT "GovernedJourneyEvent_journey_authority_fkey"
  FOREIGN KEY ("governedJourneyId", "authorityUserId")
  REFERENCES "GovernedJourney"("id", "authorityUserId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedMemorySource"
  ADD CONSTRAINT "GovernedMemorySource_journey_event_fkey"
  FOREIGN KEY ("governedJourneyEventId", "governedJourneyId")
  REFERENCES "GovernedJourneyEvent"("id", "governedJourneyId")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "check_governed_journey_event_case"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE journey_case_id text;
BEGIN
  SELECT j."relationCaseId" INTO journey_case_id
  FROM "GovernedJourney" j WHERE j.id = NEW."governedJourneyId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GovernedJourneyEvent references an unknown Journey';
  END IF;
  IF NEW."relationCaseId" IS DISTINCT FROM journey_case_id THEN
    RAISE EXCEPTION 'GovernedJourneyEvent relationCaseId differs from its Journey';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GovernedJourneyEvent_case_scope"
BEFORE INSERT OR UPDATE OF "governedJourneyId", "relationCaseId", "authorityUserId"
ON "GovernedJourneyEvent"
FOR EACH ROW EXECUTE FUNCTION "check_governed_journey_event_case"();

CREATE FUNCTION "guard_governed_journey_identity"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."relationCaseId" IS DISTINCT FROM OLD."relationCaseId"
    OR NEW."authorityUserId" IS DISTINCT FROM OLD."authorityUserId"
    OR NEW."relationTemplateId" IS DISTINCT FROM OLD."relationTemplateId" THEN
    RAISE EXCEPTION 'GovernedJourney identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GovernedJourney_identity_immutable"
BEFORE UPDATE OF "relationCaseId", "authorityUserId", "relationTemplateId"
ON "GovernedJourney"
FOR EACH ROW EXECUTE FUNCTION "guard_governed_journey_identity"();

CREATE FUNCTION "check_governed_memory_source_event_case"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_case_id text;
BEGIN
  IF NEW."governedJourneyEventId" IS NULL THEN RETURN NEW; END IF;
  IF NEW."governedJourneyId" IS NULL THEN
    RAISE EXCEPTION 'Journey event provenance requires a Journey';
  END IF;
  SELECT e."relationCaseId" INTO event_case_id
  FROM "GovernedJourneyEvent" e WHERE e.id = NEW."governedJourneyEventId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GovernedMemorySource references an unknown Journey event';
  END IF;
  IF NEW."relationCaseId" IS DISTINCT FROM event_case_id THEN
    RAISE EXCEPTION 'GovernedMemorySource relationCaseId differs from its Journey event';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GovernedMemorySource_journey_event_case_scope"
BEFORE INSERT OR UPDATE OF "governedJourneyEventId", "governedJourneyId", "relationCaseId"
ON "GovernedMemorySource"
FOR EACH ROW EXECUTE FUNCTION "check_governed_memory_source_event_case"();
