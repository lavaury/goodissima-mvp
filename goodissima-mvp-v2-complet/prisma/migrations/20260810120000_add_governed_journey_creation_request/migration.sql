-- R2-C1 adds the empty server-only idempotency structure for future human
-- creation requests. No historical journey is inferred or attached.
CREATE TABLE "GovernedJourneyCreationRequest" (
  "id" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "workspaceScopeKey" TEXT NOT NULL,
  "workspaceId" TEXT,
  "relationTemplateId" TEXT,
  "formTemplateId" TEXT,
  "governedJourneyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "GovernedJourneyCreationRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedJourneyCreationRequest_requestKey_format_check"
    CHECK ("requestKey" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT "GovernedJourneyCreationRequest_requestFingerprint_format_check"
    CHECK ("requestFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "GovernedJourneyCreationRequest_workspaceScopeKey_format_check"
    CHECK (
      char_length("workspaceScopeKey") BETWEEN 4 AND 256
      AND ("workspaceScopeKey" LIKE 'id:%' OR "workspaceScopeKey" LIKE 'slug:%')
    ),
  CONSTRAINT "GovernedJourneyCreationRequest_completeness_check"
    CHECK (
      (
        "workspaceId" IS NULL
        AND "relationTemplateId" IS NULL
        AND "formTemplateId" IS NULL
        AND "governedJourneyId" IS NULL
        AND "completedAt" IS NULL
      )
      OR
      (
        "workspaceId" IS NOT NULL
        AND "relationTemplateId" IS NOT NULL
        AND "formTemplateId" IS NOT NULL
        AND "governedJourneyId" IS NOT NULL
        AND "completedAt" IS NOT NULL
      )
    )
);

CREATE UNIQUE INDEX "GovernedJourneyCreationRequest_requesterUserId_requestKey_key"
  ON "GovernedJourneyCreationRequest"("requesterUserId", "requestKey");

CREATE UNIQUE INDEX "GovernedJourneyCreationRequest_relationTemplateId_key"
  ON "GovernedJourneyCreationRequest"("relationTemplateId");

CREATE UNIQUE INDEX "GovernedJourneyCreationRequest_formTemplateId_key"
  ON "GovernedJourneyCreationRequest"("formTemplateId");

CREATE UNIQUE INDEX "GovernedJourneyCreationRequest_governedJourneyId_key"
  ON "GovernedJourneyCreationRequest"("governedJourneyId");

CREATE INDEX "GovernedJourneyCreationRequest_requesterUserId_createdAt_idx"
  ON "GovernedJourneyCreationRequest"("requesterUserId", "createdAt");

CREATE INDEX "GovernedJourneyCreationRequest_workspaceId_createdAt_idx"
  ON "GovernedJourneyCreationRequest"("workspaceId", "createdAt");

ALTER TABLE "GovernedJourneyCreationRequest"
  ADD CONSTRAINT "GovernedJourneyCreationRequest_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyCreationRequest"
  ADD CONSTRAINT "GovernedJourneyCreationRequest_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyCreationRequest"
  ADD CONSTRAINT "GovernedJourneyCreationRequest_relationTemplateId_fkey"
  FOREIGN KEY ("relationTemplateId") REFERENCES "RelationTemplate"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyCreationRequest"
  ADD CONSTRAINT "GovernedJourneyCreationRequest_formTemplateId_fkey"
  FOREIGN KEY ("formTemplateId") REFERENCES "FormTemplate"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyCreationRequest"
  ADD CONSTRAINT "GovernedJourneyCreationRequest_governedJourneyId_fkey"
  FOREIGN KEY ("governedJourneyId") REFERENCES "GovernedJourney"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyCreationRequest" ENABLE ROW LEVEL SECURITY;
