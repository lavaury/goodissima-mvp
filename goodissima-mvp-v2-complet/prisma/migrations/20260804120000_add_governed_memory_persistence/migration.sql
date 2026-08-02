CREATE TYPE "GovernedMemoryFactStatus" AS ENUM ('PROPOSED', 'ESTABLISHED', 'DISPUTED', 'SUPERSEDED');
CREATE TYPE "GovernedMemoryEvidenceLevel" AS ENUM ('DECLARED', 'SUPPORTED', 'CORROBORATED', 'CONTESTED');
CREATE TYPE "GovernedMemoryDecisionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'SUPERSEDED', 'CANCELLED');
CREATE TYPE "GovernedMemorySourceKind" AS ENUM ('DOCUMENT', 'DOCUMENT_VERSION', 'FORM_SUBMISSION', 'MESSAGE_EXCERPT', 'SYSTEM_EVENT', 'HUMAN_DECLARATION', 'VALIDATED_SYNTHESIS', 'EXTERNAL_IMPORT');
CREATE TYPE "GovernedMemorySourceStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'RESTRICTED', 'EXPIRED', 'ANONYMIZED', 'DELETED', 'LEGAL_HOLD');
CREATE TYPE "GovernedMemoryValidationDecision" AS ENUM ('APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'WITH_RESERVATIONS');
CREATE TYPE "GovernedMemoryDisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'MAINTAINED', 'WITHDRAWN');
CREATE TYPE "GovernedMemoryRelationType" AS ENUM ('SUPPORTED_BY', 'DERIVED_FROM', 'REPLACES', 'CORRECTS', 'CANCELS', 'COMPLEMENTS', 'CONTESTS', 'VALIDATES', 'SUMMARIZES');
CREATE TYPE "GovernedMemoryPermission" AS ENUM ('VIEW_MEMORY', 'VIEW_SOURCES', 'PROPOSE_FACT', 'ESTABLISH_FACT', 'DISPUTE_FACT', 'RECORD_DECISION', 'VALIDATE_DECISION', 'VALIDATE_SYNTHESIS', 'MANAGE_MEMORY_ACCESS', 'PROMOTE_PRIVATE_SOURCE');
CREATE TYPE "GovernedMemorySubjectType" AS ENUM ('USER', 'REPRESENTATION');
CREATE TYPE "GovernedMemoryTargetType" AS ENUM ('FACT', 'DECISION', 'SOURCE');
CREATE TYPE "GovernedMemoryEventType" AS ENUM ('FACT_PROPOSED', 'FACT_ESTABLISHED', 'FACT_DISPUTED', 'FACT_SUPERSEDED', 'DECISION_RECORDED', 'DECISION_VALIDATED', 'DECISION_SUPERSEDED', 'DECISION_CANCELLED', 'SOURCE_REGISTERED', 'SOURCE_PROMOTED', 'SOURCE_RESTRICTED', 'SOURCE_DELETED', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'VALIDATION_RECORDED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED');
CREATE TYPE "GovernedMemoryActorType" AS ENUM ('HUMAN', 'SYSTEM');
CREATE TYPE "GovernedMemoryRole" AS ENUM ('MEMORY_STEWARD', 'MEMORY_DELEGATE');

CREATE TABLE "GovernedMemoryFact" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "statement" TEXT NOT NULL,
  "status" "GovernedMemoryFactStatus" NOT NULL DEFAULT 'PROPOSED',
  "evidenceLevel" "GovernedMemoryEvidenceLevel" NOT NULL DEFAULT 'DECLARED',
  "authorUserId" TEXT NOT NULL, "authorRepresentationId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveUntil" TIMESTAMP(3),
  "establishedByUserId" TEXT, "establishedAt" TIMESTAMP(3), "supersedesFactId" TEXT, "supersededByFactId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMemoryFact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryFact_statement_check" CHECK (length(btrim("statement")) BETWEEN 1 AND 4000),
  CONSTRAINT "GovernedMemoryFact_interval_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  CONSTRAINT "GovernedMemoryFact_establishment_check" CHECK (
    ("status" = 'PROPOSED' AND "establishedAt" IS NULL AND "establishedByUserId" IS NULL)
    OR ("status" = 'ESTABLISHED' AND "establishedAt" IS NOT NULL AND "establishedByUserId" IS NOT NULL)
    OR "status" IN ('DISPUTED', 'SUPERSEDED')
  ),
  CONSTRAINT "GovernedMemoryFact_superseded_check" CHECK ("status" <> 'SUPERSEDED' OR "supersededByFactId" IS NOT NULL),
  CONSTRAINT "GovernedMemoryFact_no_self_reference_check" CHECK ("supersedesFactId" IS DISTINCT FROM "id" AND "supersededByFactId" IS DISTINCT FROM "id")
);

CREATE TABLE "GovernedMemoryDecision" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "title" TEXT NOT NULL, "rationale" TEXT NOT NULL,
  "status" "GovernedMemoryDecisionStatus" NOT NULL DEFAULT 'DRAFT', "decidedByUserId" TEXT NOT NULL,
  "validatedByUserId" TEXT, "decidedAt" TIMESTAMP(3) NOT NULL, "validatedAt" TIMESTAMP(3),
  "recordedAt" TIMESTAMP(3) NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveUntil" TIMESTAMP(3),
  "consequences" TEXT, "reservations" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMemoryDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryDecision_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 300),
  CONSTRAINT "GovernedMemoryDecision_interval_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  CONSTRAINT "GovernedMemoryDecision_validation_check" CHECK ("status" <> 'VALIDATED' OR (length(btrim("rationale")) > 0 AND "validatedByUserId" IS NOT NULL AND "validatedAt" IS NOT NULL))
);

CREATE TABLE "GovernedMemorySource" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "kind" "GovernedMemorySourceKind" NOT NULL,
  "status" "GovernedMemorySourceStatus" NOT NULL DEFAULT 'ACTIVE', "sourceObjectType" TEXT NOT NULL, "sourceObjectId" TEXT NOT NULL,
  "title" TEXT NOT NULL, "authoredAt" TIMESTAMP(3), "receivedAt" TIMESTAMP(3), "recordedAt" TIMESTAMP(3) NOT NULL,
  "promotedByUserId" TEXT, "promotedAt" TIMESTAMP(3), "visibilityPolicyRef" TEXT, "retentionPolicyRef" TEXT,
  "integrityRef" TEXT, "unavailableReason" TEXT, "excerpt" TEXT, "promotionPurpose" TEXT, "consentBasis" TEXT, "externalOrigin" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMemorySource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemorySource_title_check" CHECK (length(btrim("title")) BETWEEN 1 AND 300),
  CONSTRAINT "GovernedMemorySource_message_promotion_check" CHECK (
    "kind" <> 'MESSAGE_EXCERPT' OR (
      "promotedByUserId" IS NOT NULL AND "promotedAt" IS NOT NULL AND
      length(btrim(COALESCE("excerpt", ''))) BETWEEN 1 AND 2000 AND
      length(btrim(COALESCE("promotionPurpose", ''))) BETWEEN 1 AND 500 AND
      length(btrim(COALESCE("consentBasis", ''))) > 0
    )
  ),
  CONSTRAINT "GovernedMemorySource_unavailable_check" CHECK ("status" NOT IN ('DELETED', 'ANONYMIZED') OR length(btrim(COALESCE("unavailableReason", ''))) > 0),
  CONSTRAINT "GovernedMemorySource_external_check" CHECK ("kind" <> 'EXTERNAL_IMPORT' OR length(btrim(COALESCE("externalOrigin", ''))) > 0)
);

CREATE TABLE "GovernedMemoryRelation" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "type" "GovernedMemoryRelationType" NOT NULL,
  "sourceType" "GovernedMemoryTargetType" NOT NULL, "sourceId" TEXT NOT NULL,
  "targetType" "GovernedMemoryTargetType" NOT NULL, "targetId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedMemoryRelation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryRelation_no_self_reference_check" CHECK ("sourceType" <> "targetType" OR "sourceId" <> "targetId"),
  CONSTRAINT "GovernedMemoryRelation_allowed_pair_check" CHECK (
    ("type" = 'SUPPORTED_BY' AND "sourceType" IN ('FACT', 'DECISION') AND "targetType" = 'SOURCE') OR
    ("type" = 'DERIVED_FROM' AND "sourceType" = 'DECISION' AND "targetType" IN ('FACT', 'SOURCE')) OR
    ("type" IN ('REPLACES', 'CORRECTS', 'CANCELS', 'COMPLEMENTS') AND "sourceType" = "targetType" AND "sourceType" IN ('FACT', 'DECISION'))
  )
);

CREATE TABLE "GovernedMemoryValidation" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "targetType" "GovernedMemoryTargetType" NOT NULL, "targetId" TEXT NOT NULL,
  "validatorUserId" TEXT NOT NULL, "validatorRole" "GovernedMemoryRole" NOT NULL,
  "decision" "GovernedMemoryValidationDecision" NOT NULL, "rationale" TEXT, "reservations" TEXT,
  "validatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedMemoryValidation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryValidation_rationale_check" CHECK ("decision" = 'APPROVED' OR length(btrim(COALESCE("rationale", ''))) > 0),
  CONSTRAINT "GovernedMemoryValidation_reservations_check" CHECK ("decision" NOT IN ('PARTIALLY_APPROVED', 'WITH_RESERVATIONS') OR length(btrim(COALESCE("reservations", ''))) > 0)
);

CREATE TABLE "GovernedMemoryDispute" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "targetType" "GovernedMemoryTargetType" NOT NULL, "targetId" TEXT NOT NULL,
  "raisedByUserId" TEXT NOT NULL, "reason" TEXT NOT NULL, "status" "GovernedMemoryDisputeStatus" NOT NULL DEFAULT 'OPEN',
  "raisedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), "resolvedByUserId" TEXT, "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMemoryDispute_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryDispute_reason_check" CHECK (length(btrim("reason")) BETWEEN 1 AND 4000),
  CONSTRAINT "GovernedMemoryDispute_resolution_check" CHECK (
    ("status" = 'OPEN' AND "resolvedAt" IS NULL AND "resolvedByUserId" IS NULL AND "resolution" IS NULL) OR
    ("status" IN ('RESOLVED', 'MAINTAINED') AND "resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL AND length(btrim(COALESCE("resolution", ''))) > 0) OR
    ("status" = 'WITHDRAWN' AND "resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL AND length(btrim(COALESCE("resolution", ''))) > 0)
  )
);

CREATE TABLE "GovernedMemoryAccessGrant" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "subjectType" "GovernedMemorySubjectType" NOT NULL,
  "subjectUserId" TEXT, "subjectRepresentationId" TEXT, "permission" "GovernedMemoryPermission" NOT NULL,
  "resourceType" "GovernedMemoryTargetType", "resourceId" TEXT, "grantedByUserId" TEXT NOT NULL, "basis" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL, "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3), "revokedByUserId" TEXT, "residualPermission" "GovernedMemoryPermission",
  "residualEffectiveUntil" TIMESTAMP(3), "residualBasis" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GovernedMemoryAccessGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryAccessGrant_subject_check" CHECK (
    ("subjectType" = 'USER' AND "subjectUserId" IS NOT NULL AND "subjectRepresentationId" IS NULL) OR
    ("subjectType" = 'REPRESENTATION' AND "subjectRepresentationId" IS NOT NULL AND "subjectUserId" IS NULL)
  ),
  CONSTRAINT "GovernedMemoryAccessGrant_basis_check" CHECK (length(btrim("basis")) > 0),
  CONSTRAINT "GovernedMemoryAccessGrant_interval_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  CONSTRAINT "GovernedMemoryAccessGrant_revocation_check" CHECK (("revokedAt" IS NULL AND "revokedByUserId" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL)),
  CONSTRAINT "GovernedMemoryAccessGrant_resource_check" CHECK (("resourceType" IS NULL) = ("resourceId" IS NULL)),
  CONSTRAINT "GovernedMemoryAccessGrant_residual_check" CHECK (
    ("residualPermission" IS NULL AND "residualEffectiveUntil" IS NULL AND "residualBasis" IS NULL) OR
    ("revokedAt" IS NOT NULL AND "residualPermission" IS NOT NULL AND "residualEffectiveUntil" > "revokedAt" AND length(btrim(COALESCE("residualBasis", ''))) > 0)
  )
);

CREATE TABLE "GovernedMemoryEvent" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "type" "GovernedMemoryEventType" NOT NULL,
  "actorType" "GovernedMemoryActorType" NOT NULL, "actorUserId" TEXT, "actorRepresentationId" TEXT,
  "objectType" "GovernedMemoryTargetType" NOT NULL, "objectId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL, "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedMemoryEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryEvent_actor_check" CHECK (
    ("actorType" = 'SYSTEM' AND "actorUserId" IS NULL AND "actorRepresentationId" IS NULL) OR
    ("actorType" = 'HUMAN' AND "actorUserId" IS NOT NULL)
  ),
  CONSTRAINT "GovernedMemoryEvent_summary_check" CHECK (length(btrim("summary")) BETWEEN 1 AND 2000)
);

CREATE TABLE "GovernedMemoryRoleAssignment" (
  "id" TEXT NOT NULL, "relationCaseId" TEXT NOT NULL, "userId" TEXT NOT NULL, "role" "GovernedMemoryRole" NOT NULL,
  "assignedByUserId" TEXT NOT NULL, "assignedAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "revokedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GovernedMemoryRoleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GovernedMemoryRoleAssignment_revocation_check" CHECK (("revokedAt" IS NULL AND "revokedByUserId" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokedByUserId" IS NOT NULL))
);

CREATE UNIQUE INDEX "GovernedMemoryFact_id_relationCaseId_key" ON "GovernedMemoryFact"("id", "relationCaseId");
CREATE INDEX "GovernedMemoryFact_relationCaseId_recordedAt_id_idx" ON "GovernedMemoryFact"("relationCaseId", "recordedAt", "id");
CREATE INDEX "GovernedMemoryFact_relationCaseId_effectiveFrom_effectiveUntil_idx" ON "GovernedMemoryFact"("relationCaseId", "effectiveFrom", "effectiveUntil");
CREATE INDEX "GovernedMemoryFact_relationCaseId_status_idx" ON "GovernedMemoryFact"("relationCaseId", "status");
CREATE UNIQUE INDEX "GovernedMemoryDecision_id_relationCaseId_key" ON "GovernedMemoryDecision"("id", "relationCaseId");
CREATE INDEX "GovernedMemoryDecision_relationCaseId_recordedAt_id_idx" ON "GovernedMemoryDecision"("relationCaseId", "recordedAt", "id");
CREATE INDEX "GovernedMemoryDecision_relationCaseId_effectiveFrom_effectiveUntil_idx" ON "GovernedMemoryDecision"("relationCaseId", "effectiveFrom", "effectiveUntil");
CREATE INDEX "GovernedMemoryDecision_relationCaseId_status_idx" ON "GovernedMemoryDecision"("relationCaseId", "status");
CREATE UNIQUE INDEX "GovernedMemorySource_id_relationCaseId_key" ON "GovernedMemorySource"("id", "relationCaseId");
CREATE INDEX "GovernedMemorySource_relationCaseId_status_recordedAt_idx" ON "GovernedMemorySource"("relationCaseId", "status", "recordedAt");
CREATE INDEX "GovernedMemorySource_relationCaseId_kind_idx" ON "GovernedMemorySource"("relationCaseId", "kind");
CREATE INDEX "GovernedMemorySource_sourceObjectType_sourceObjectId_idx" ON "GovernedMemorySource"("sourceObjectType", "sourceObjectId");
CREATE UNIQUE INDEX "GovernedMemoryRelation_exact_key" ON "GovernedMemoryRelation"("relationCaseId", "type", "sourceType", "sourceId", "targetType", "targetId");
CREATE INDEX "GovernedMemoryRelation_source_idx" ON "GovernedMemoryRelation"("relationCaseId", "sourceType", "sourceId");
CREATE INDEX "GovernedMemoryRelation_target_idx" ON "GovernedMemoryRelation"("relationCaseId", "targetType", "targetId");
CREATE INDEX "GovernedMemoryValidation_target_idx" ON "GovernedMemoryValidation"("relationCaseId", "targetType", "targetId", "validatedAt");
CREATE UNIQUE INDEX "GovernedMemoryDispute_id_relationCaseId_key" ON "GovernedMemoryDispute"("id", "relationCaseId");
CREATE INDEX "GovernedMemoryDispute_target_status_idx" ON "GovernedMemoryDispute"("relationCaseId", "targetType", "targetId", "status");
CREATE INDEX "GovernedMemoryDispute_relationCaseId_raisedAt_idx" ON "GovernedMemoryDispute"("relationCaseId", "raisedAt");
CREATE UNIQUE INDEX "GovernedMemoryAccessGrant_id_relationCaseId_key" ON "GovernedMemoryAccessGrant"("id", "relationCaseId");
CREATE INDEX "GovernedMemoryAccessGrant_user_effective_idx" ON "GovernedMemoryAccessGrant"("relationCaseId", "subjectUserId", "permission", "effectiveFrom");
CREATE INDEX "GovernedMemoryAccessGrant_representation_effective_idx" ON "GovernedMemoryAccessGrant"("relationCaseId", "subjectRepresentationId", "permission", "effectiveFrom");
CREATE INDEX "GovernedMemoryAccessGrant_resource_idx" ON "GovernedMemoryAccessGrant"("relationCaseId", "resourceType", "resourceId");
CREATE INDEX "GovernedMemoryEvent_relationCaseId_recordedAt_id_idx" ON "GovernedMemoryEvent"("relationCaseId", "recordedAt", "id");
CREATE INDEX "GovernedMemoryEvent_object_idx" ON "GovernedMemoryEvent"("relationCaseId", "objectType", "objectId");
CREATE INDEX "GovernedMemoryRoleAssignment_subject_idx" ON "GovernedMemoryRoleAssignment"("relationCaseId", "userId", "role", "assignedAt");
CREATE INDEX "GovernedMemoryRoleAssignment_role_idx" ON "GovernedMemoryRoleAssignment"("relationCaseId", "role", "revokedAt");
CREATE UNIQUE INDEX "GovernedMemoryRoleAssignment_active_steward_key" ON "GovernedMemoryRoleAssignment"("relationCaseId") WHERE "role" = 'MEMORY_STEWARD' AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX "GovernedMemoryRoleAssignment_active_subject_role_key" ON "GovernedMemoryRoleAssignment"("relationCaseId", "userId", "role") WHERE "revokedAt" IS NULL;

ALTER TABLE "GovernedMemoryFact" ADD CONSTRAINT "GovernedMemoryFact_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryFact" ADD CONSTRAINT "GovernedMemoryFact_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryFact" ADD CONSTRAINT "GovernedMemoryFact_authorRepresentationId_authorUserId_fkey" FOREIGN KEY ("authorRepresentationId", "authorUserId") REFERENCES "Representation"("id", "ownerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryFact" ADD CONSTRAINT "GovernedMemoryFact_establishedByUserId_fkey" FOREIGN KEY ("establishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryFact" ADD CONSTRAINT "GovernedMemoryFact_supersedesFactId_relationCaseId_fkey" FOREIGN KEY ("supersedesFactId", "relationCaseId") REFERENCES "GovernedMemoryFact"("id", "relationCaseId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryFact" ADD CONSTRAINT "GovernedMemoryFact_supersededByFactId_relationCaseId_fkey" FOREIGN KEY ("supersededByFactId", "relationCaseId") REFERENCES "GovernedMemoryFact"("id", "relationCaseId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryDecision" ADD CONSTRAINT "GovernedMemoryDecision_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryDecision" ADD CONSTRAINT "GovernedMemoryDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryDecision" ADD CONSTRAINT "GovernedMemoryDecision_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemorySource" ADD CONSTRAINT "GovernedMemorySource_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemorySource" ADD CONSTRAINT "GovernedMemorySource_promotedByUserId_fkey" FOREIGN KEY ("promotedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryRelation" ADD CONSTRAINT "GovernedMemoryRelation_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryRelation" ADD CONSTRAINT "GovernedMemoryRelation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryValidation" ADD CONSTRAINT "GovernedMemoryValidation_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryValidation" ADD CONSTRAINT "GovernedMemoryValidation_validatorUserId_fkey" FOREIGN KEY ("validatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_raisedByUserId_fkey" FOREIGN KEY ("raisedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryDispute" ADD CONSTRAINT "GovernedMemoryDispute_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryAccessGrant" ADD CONSTRAINT "GovernedMemoryAccessGrant_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryAccessGrant" ADD CONSTRAINT "GovernedMemoryAccessGrant_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryAccessGrant" ADD CONSTRAINT "GovernedMemoryAccessGrant_subjectRepresentationId_fkey" FOREIGN KEY ("subjectRepresentationId") REFERENCES "Representation"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryAccessGrant" ADD CONSTRAINT "GovernedMemoryAccessGrant_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryAccessGrant" ADD CONSTRAINT "GovernedMemoryAccessGrant_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryEvent" ADD CONSTRAINT "GovernedMemoryEvent_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryEvent" ADD CONSTRAINT "GovernedMemoryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryEvent" ADD CONSTRAINT "GovernedMemoryEvent_actorRepresentationId_actorUserId_fkey" FOREIGN KEY ("actorRepresentationId", "actorUserId") REFERENCES "Representation"("id", "ownerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryRoleAssignment" ADD CONSTRAINT "GovernedMemoryRoleAssignment_relationCaseId_fkey" FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "GovernedMemoryRoleAssignment" ADD CONSTRAINT "GovernedMemoryRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryRoleAssignment" ADD CONSTRAINT "GovernedMemoryRoleAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GovernedMemoryRoleAssignment" ADD CONSTRAINT "GovernedMemoryRoleAssignment_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GovernedMemoryFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemorySource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryRelation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryValidation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryDispute" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryAccessGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernedMemoryRoleAssignment" ENABLE ROW LEVEL SECURITY;
