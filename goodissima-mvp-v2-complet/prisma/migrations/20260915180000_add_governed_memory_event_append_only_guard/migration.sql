-- GovernedMemoryEvent is an immutable audit journal. Corrections and
-- reversals must be represented by later events, never by rewriting history.
CREATE OR REPLACE FUNCTION "reject_governed_memory_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'GovernedMemoryEvent is append-only';
END;
$$;

DROP TRIGGER IF EXISTS "GovernedMemoryEvent_append_only" ON "GovernedMemoryEvent";

CREATE TRIGGER "GovernedMemoryEvent_append_only"
BEFORE UPDATE OR DELETE ON "GovernedMemoryEvent"
FOR EACH ROW
EXECUTE FUNCTION "reject_governed_memory_event_mutation"();
