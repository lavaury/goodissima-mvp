import type { Prisma } from "@prisma/client";

export type CreateGovernedJourneyExtensionInput = {
  tx: Prisma.TransactionClient;
  relationTemplateId: string;
  formTemplateId: string;
  templateVersionId: string;
  authorityUserId: string;
  title: string;
};

/** Creates the ledger extension; FormTemplate.name remains the canonical name. */
export function createGovernedJourneyExtensionInTransaction({
  tx,
  relationTemplateId,
  formTemplateId,
  templateVersionId,
  authorityUserId,
  title,
}: CreateGovernedJourneyExtensionInput) {
  return tx.governedJourney.create({
    data: {
      relationTemplateId,
      formTemplateId,
      createdFromTemplateVersionId: templateVersionId,
      authorityUserId,
      relationCaseId: null,
      title,
      // Technical ledger state only; it is never synchronized with the cockpit.
      status: "DRAFT",
      version: 1,
      currentStepKey: null,
      startedAt: null,
      suspendedAt: null,
      closedAt: null,
      cancelledAt: null,
    },
  });
}
