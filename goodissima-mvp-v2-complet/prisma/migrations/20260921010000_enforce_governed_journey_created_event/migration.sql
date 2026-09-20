-- M2: enforce the CREATED lifecycle event for every new Journey at commit.
-- Existing rows are checked, never backfilled or changed here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "GovernedJourney" j
    LEFT JOIN "GovernedJourneyEvent" e
      ON e."governedJourneyId" = j.id AND e.type = 'CREATED'
    GROUP BY j.id, j."authorityUserId", j."relationCaseId"
    HAVING count(e.id) <> 1
       OR count(e.id) FILTER (WHERE e.sequence IS DISTINCT FROM 1
         OR e."fromStatus" IS NOT NULL OR e."toStatus" IS DISTINCT FROM 'DRAFT'
         OR e."actorUserId" IS DISTINCT FROM j."authorityUserId"
         OR e."authorityUserId" IS DISTINCT FROM j."authorityUserId"
         OR e."relationCaseId" IS DISTINCT FROM j."relationCaseId") <> 0
  ) OR EXISTS (
    SELECT 1 FROM "GovernedJourneyEvent" e
    LEFT JOIN "GovernedJourney" j ON j.id = e."governedJourneyId"
    WHERE j.id IS NULL OR e."authorityUserId" IS DISTINCT FROM j."authorityUserId"
      OR e."relationCaseId" IS DISTINCT FROM j."relationCaseId"
  ) THEN
    RAISE EXCEPTION 'M2 preflight: inconsistent Journey CREATED lifecycle';
  END IF;
END;
$$;

CREATE FUNCTION "check_governed_journey_created_at_commit"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE created_count bigint;
BEGIN
  SELECT count(*) INTO created_count
  FROM "GovernedJourneyEvent" e
  WHERE e."governedJourneyId" = NEW.id
    AND e.type = 'CREATED'
    AND e.sequence = 1
    AND e."fromStatus" IS NULL
    AND e."toStatus" = 'DRAFT'
    AND e."actorUserId" = NEW."authorityUserId"
    AND e."authorityUserId" = NEW."authorityUserId"
    AND e."relationCaseId" IS NOT DISTINCT FROM NEW."relationCaseId";

  IF created_count <> 1 OR (
    SELECT count(*) FROM "GovernedJourneyEvent" e
    WHERE e."governedJourneyId" = NEW.id AND e.type = 'CREATED'
  ) <> 1 THEN
    RAISE EXCEPTION 'GovernedJourney requires exactly one valid CREATED event at commit';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "GovernedJourney_created_at_commit"
AFTER INSERT ON "GovernedJourney"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_governed_journey_created_at_commit"();
