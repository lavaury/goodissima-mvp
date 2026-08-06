import { prisma } from "@/lib/prisma";
import { ROLE_PERMISSIONS } from "@/lib/governed-memory/permissions";

export type GovernedMemoryCreationCapabilities = {
  canCreateAny: boolean;
  categories: { fact: boolean; decision: boolean; source: boolean };
  availableContexts: readonly [];
};

const NONE: GovernedMemoryCreationCapabilities = {
  canCreateAny: false,
  categories: { fact: false, decision: false, source: false },
  availableContexts: [],
};

export async function getGovernedMemoryCreationCapabilities(input: {
  formTemplateId: string;
  workspaceId: string;
  requesterUserId: string;
}): Promise<GovernedMemoryCreationCapabilities> {
  const root = await prisma.formTemplate.findFirst({
    where: {
      id: input.formTemplateId,
      relationTemplate: {
        workspaceId: input.workspaceId,
        workspace: { ownerId: input.requesterUserId, status: "ACTIVE" },
      },
    },
    select: {
      relationTemplate: { select: { governedJourney: { select: { relationCaseId: true } } } },
    },
  });
  const extension = root?.relationTemplate?.governedJourney;
  if (!extension) return NONE;

  // R5-II creates only at journey scope. This is the same owner authority
  // resolved again by the commands when relationCaseId is intentionally absent.
  const access = { permissions: new Set(ROLE_PERMISSIONS.RELATION_CASE_OWNER) };
  const categories = {
    fact: access.permissions.has("PROPOSE_FACT"),
    decision: access.permissions.has("RECORD_DECISION"),
    source: access.permissions.has("REGISTER_SOURCE"),
  };
  return { canCreateAny: Object.values(categories).some(Boolean), categories, availableContexts: [] };
}
