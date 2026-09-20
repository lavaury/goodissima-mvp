-- Preserve a composite key that lets assignments prove an invitation belongs
-- to the same logical Journey through the immutable Journey template identity.
CREATE UNIQUE INDEX "GovernedJourneyInvitation_id_relationTemplateId_key"
ON "GovernedJourneyInvitation"("id", "relationTemplateId");

CREATE TABLE "GovernedJourneyExpectedRoleAssignment" (
    "id" TEXT NOT NULL,
    "governedJourneyId" TEXT NOT NULL,
    "relationTemplateId" TEXT NOT NULL,
    "expectedRoleId" TEXT NOT NULL,
    "assigneeUserId" TEXT,
    "assigneeInvitationId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernedJourneyExpectedRoleAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GovernedJourneyExpectedRoleAssignment_assignee_xor_check"
      CHECK (("assigneeUserId" IS NOT NULL) <> ("assigneeInvitationId" IS NOT NULL))
);

CREATE UNIQUE INDEX "ExpectedRoleAssignment_active_role_key"
ON "GovernedJourneyExpectedRoleAssignment"("governedJourneyId", "expectedRoleId")
WHERE "revokedAt" IS NULL;

CREATE INDEX "GovernedJourneyExpectedRoleAssignment_governedJourneyId_idx"
ON "GovernedJourneyExpectedRoleAssignment"("governedJourneyId");
CREATE INDEX "GovernedJourneyExpectedRoleAssignment_relationTemplateId_idx"
ON "GovernedJourneyExpectedRoleAssignment"("relationTemplateId");
CREATE INDEX "GovernedJourneyExpectedRoleAssignment_assigneeUserId_idx"
ON "GovernedJourneyExpectedRoleAssignment"("assigneeUserId");
CREATE INDEX "ExpectedRoleAssignment_invitation_template_idx"
ON "GovernedJourneyExpectedRoleAssignment"("assigneeInvitationId", "relationTemplateId");
CREATE INDEX "GovernedJourneyExpectedRoleAssignment_assignedByUserId_idx"
ON "GovernedJourneyExpectedRoleAssignment"("assignedByUserId");
CREATE INDEX "GovernedJourneyExpectedRoleAssignment_revokedByUserId_idx"
ON "GovernedJourneyExpectedRoleAssignment"("revokedByUserId");

ALTER TABLE "GovernedJourneyExpectedRoleAssignment"
ADD CONSTRAINT "ExpectedRoleAssignment_journey_fkey"
FOREIGN KEY ("governedJourneyId", "relationTemplateId")
REFERENCES "GovernedJourney"("id", "relationTemplateId")
ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyExpectedRoleAssignment"
ADD CONSTRAINT "GovernedJourneyExpectedRoleAssignment_assigneeUserId_fkey"
FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyExpectedRoleAssignment"
ADD CONSTRAINT "ExpectedRoleAssignment_invitation_fkey"
FOREIGN KEY ("assigneeInvitationId", "relationTemplateId")
REFERENCES "GovernedJourneyInvitation"("id", "relationTemplateId")
ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyExpectedRoleAssignment"
ADD CONSTRAINT "GovernedJourneyExpectedRoleAssignment_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "GovernedJourneyExpectedRoleAssignment"
ADD CONSTRAINT "GovernedJourneyExpectedRoleAssignment_revokedByUserId_fkey"
FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE RESTRICT;
