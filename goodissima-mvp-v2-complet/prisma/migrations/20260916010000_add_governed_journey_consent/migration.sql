CREATE TYPE "JourneyConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "GovernedJourneyConsentEventType" AS ENUM ('CREATED', 'ACCEPTED', 'DECLINED', 'REVOKED');
CREATE TYPE "GovernedJourneyConsentActorKind" AS ENUM ('INVITEE', 'OWNER', 'SYSTEM');

ALTER TABLE "GovernedJourneyInvitation" ADD COLUMN "inviteeUserId" TEXT;

CREATE TABLE "GovernedJourneyConsent" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "status" "JourneyConsentStatus" NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedJourneyConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedJourneyConsent_decision_time_check" CHECK (("status" = 'PENDING' AND "decidedAt" IS NULL) OR ("status" IN ('ACCEPTED', 'DECLINED') AND "decidedAt" IS NOT NULL))
);

CREATE TABLE "GovernedJourneyConsentEvent" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "consentId" TEXT,
  "type" "GovernedJourneyConsentEventType" NOT NULL,
  "actorUserId" TEXT,
  "actorKind" "GovernedJourneyConsentActorKind" NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "consentVersion" INTEGER,
  "roleSnapshot" "GovernedJourneyInvitationRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedJourneyConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernedJourneyConsent_invitationId_key" ON "GovernedJourneyConsent"("invitationId");
CREATE INDEX "GovernedJourneyConsent_status_updatedAt_idx" ON "GovernedJourneyConsent"("status", "updatedAt");
CREATE INDEX "GovernedJourneyInvitation_inviteeUserId_status_createdAt_idx" ON "GovernedJourneyInvitation"("inviteeUserId", "status", "createdAt");
CREATE INDEX "GovernedJourneyConsentEvent_invitationId_occurredAt_id_idx" ON "GovernedJourneyConsentEvent"("invitationId", "occurredAt", "id");
CREATE INDEX "GovernedJourneyConsentEvent_consentId_occurredAt_id_idx" ON "GovernedJourneyConsentEvent"("consentId", "occurredAt", "id");

ALTER TABLE "GovernedJourneyInvitation" ADD CONSTRAINT "GovernedJourneyInvitation_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyConsent" ADD CONSTRAINT "GovernedJourneyConsent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "GovernedJourneyInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyConsent" ADD CONSTRAINT "GovernedJourneyConsent_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyConsentEvent" ADD CONSTRAINT "GovernedJourneyConsentEvent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "GovernedJourneyInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyConsentEvent" ADD CONSTRAINT "GovernedJourneyConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "GovernedJourneyConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedJourneyConsentEvent" ADD CONSTRAINT "GovernedJourneyConsentEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION "reject_governed_journey_consent_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'GovernedJourneyConsentEvent is append-only';
END;
$$;

CREATE TRIGGER "GovernedJourneyConsentEvent_append_only"
BEFORE UPDATE OR DELETE ON "GovernedJourneyConsentEvent"
FOR EACH ROW
EXECUTE FUNCTION "reject_governed_journey_consent_event_mutation"();
