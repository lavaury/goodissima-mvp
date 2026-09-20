import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Client = Prisma.TransactionClient | typeof prisma;

// The Journey, not its optional Workspace or a client-supplied object ID,
// establishes the authority for governed Journey mutations.
export async function resolveOwnedGovernedJourney(
  client: Client,
  input: { formTemplateId: string; authorityUserId: string; governedJourneyId?: string },
) {
  if (!input.formTemplateId || !input.authorityUserId) return null;
  const journey = await client.governedJourney.findFirst({
    where: {
      formTemplateId: input.formTemplateId,
      authorityUserId: input.authorityUserId,
      ...(input.governedJourneyId ? { id: input.governedJourneyId } : {}),
    },
    select: {
      id: true,
      formTemplateId: true,
      relationTemplateId: true,
      authorityUserId: true,
      status: true,
      relationTemplate: { select: { workspaceId: true, workspace: { select: { ownerId: true } } } },
    },
  });
  if (!journey || journey.relationTemplate.workspaceId && journey.relationTemplate.workspace?.ownerId !== input.authorityUserId) return null;
  return {
    id: journey.id,
    formTemplateId: journey.formTemplateId!,
    relationTemplateId: journey.relationTemplateId,
    authorityUserId: journey.authorityUserId,
    workspaceId: journey.relationTemplate.workspaceId,
    status: journey.status,
  };
}
