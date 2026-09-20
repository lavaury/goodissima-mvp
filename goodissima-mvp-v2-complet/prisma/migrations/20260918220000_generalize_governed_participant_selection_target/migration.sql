CREATE TYPE "GovernedParticipantSelectionTargetType" AS ENUM ('JOURNEY', 'MEETING');

ALTER TABLE "GovernedParticipantSelection"
  ADD COLUMN "targetType" "GovernedParticipantSelectionTargetType" NOT NULL,
  ALTER COLUMN "communicationSessionId" DROP NOT NULL;

ALTER TABLE "GovernedParticipantSelection"
  ADD CONSTRAINT "GovernedParticipantSelection_target_check" CHECK (
    ("targetType" = 'JOURNEY' AND "communicationSessionId" IS NULL)
    OR ("targetType" = 'MEETING' AND "communicationSessionId" IS NOT NULL)
  );

ALTER TABLE "GovernedParticipantSelectionItem"
  ADD COLUMN "materializedJourneyInvitationId" TEXT,
  DROP CONSTRAINT "GovernedParticipantSelectionItem_selection_fkey",
  DROP CONSTRAINT "GovernedParticipantSelectionItem_source_participant_fkey",
  DROP CONSTRAINT "GovernedParticipantSelectionItem_materialized_participant_fkey",
  DROP COLUMN "communicationSessionId";

ALTER TABLE "GovernedParticipantSelectionItem"
  ADD CONSTRAINT "GovernedParticipantSelectionItem_materialization_xor_check" CHECK (
    num_nonnulls("materializedJourneyInvitationId", "materializedMeetingParticipantId") <= 1
  ),
  ADD CONSTRAINT "GovernedParticipantSelectionItem_selection_fkey"
    FOREIGN KEY ("selectionId") REFERENCES "GovernedParticipantSelection"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedParticipantSelectionItem_source_participant_fkey"
    FOREIGN KEY ("sourceMeetingParticipantId") REFERENCES "GovernedMeetingParticipant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedParticipantSelectionItem_materialized_invitation_fkey"
    FOREIGN KEY ("materializedJourneyInvitationId", "relationTemplateId") REFERENCES "GovernedJourneyInvitation"("id", "relationTemplateId") ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "GovernedParticipantSelectionItem_materialized_participant_fkey"
    FOREIGN KEY ("materializedMeetingParticipantId") REFERENCES "GovernedMeetingParticipant"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP INDEX "GovernedParticipantSelection_item_scope_key";
DROP INDEX "GovernedParticipantSelection_scope_idx";

CREATE INDEX "GovernedParticipantSelection_scope_idx"
  ON "GovernedParticipantSelection"("ownerId", "governedJourneyId", "targetType");
CREATE INDEX "GovernedParticipantSelection_source_status_createdAt_idx"
  ON "GovernedParticipantSelection"("source", "status", "createdAt");
CREATE UNIQUE INDEX "GovernedParticipantSelectionItem_materializedJourneyInvitationId_key"
  ON "GovernedParticipantSelectionItem"("materializedJourneyInvitationId");

CREATE FUNCTION enforce_governed_participant_selection_materialization_target()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  selection_target "GovernedParticipantSelectionTargetType";
  selection_session_id TEXT;
  selection_template_id TEXT;
  participant_session_id TEXT;
BEGIN
  SELECT "targetType", "communicationSessionId", "relationTemplateId"
    INTO selection_target, selection_session_id, selection_template_id
    FROM "GovernedParticipantSelection"
    WHERE "id" = NEW."selectionId";

  IF selection_target IS NULL THEN
    RAISE EXCEPTION 'GovernedParticipantSelectionItem selection is unavailable';
  END IF;

  IF NEW."relationTemplateId" IS DISTINCT FROM selection_template_id THEN
    RAISE EXCEPTION 'GovernedParticipantSelectionItem is outside the target Journey';
  END IF;

  IF NEW."materializedJourneyInvitationId" IS NOT NULL AND selection_target <> 'JOURNEY' THEN
    RAISE EXCEPTION 'Journey invitation materialization requires a JOURNEY target';
  END IF;

  IF NEW."materializedMeetingParticipantId" IS NOT NULL THEN
    IF selection_target <> 'MEETING' THEN
      RAISE EXCEPTION 'Meeting participant materialization requires a MEETING target';
    END IF;
    SELECT "communicationSessionId" INTO participant_session_id
      FROM "GovernedMeetingParticipant"
      WHERE "id" = NEW."materializedMeetingParticipantId";
    IF participant_session_id IS DISTINCT FROM selection_session_id THEN
      RAISE EXCEPTION 'Meeting participant materialization is outside the target meeting';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "GovernedParticipantSelectionItem_materialization_target"
BEFORE INSERT OR UPDATE OF "selectionId", "materializedJourneyInvitationId", "materializedMeetingParticipantId"
ON "GovernedParticipantSelectionItem"
FOR EACH ROW EXECUTE FUNCTION enforce_governed_participant_selection_materialization_target();

CREATE FUNCTION reject_governed_participant_selection_scope_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (
    OLD."targetType" IS DISTINCT FROM NEW."targetType"
    OR OLD."governedJourneyId" IS DISTINCT FROM NEW."governedJourneyId"
    OR OLD."relationTemplateId" IS DISTINCT FROM NEW."relationTemplateId"
    OR OLD."communicationSessionId" IS DISTINCT FROM NEW."communicationSessionId"
  ) AND EXISTS (
    SELECT 1 FROM "GovernedParticipantSelectionItem" WHERE "selectionId" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'GovernedParticipantSelection target scope is immutable after items exist';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "GovernedParticipantSelection_scope_immutable"
BEFORE UPDATE OF "targetType", "governedJourneyId", "relationTemplateId", "communicationSessionId"
ON "GovernedParticipantSelection"
FOR EACH ROW EXECUTE FUNCTION reject_governed_participant_selection_scope_mutation();
