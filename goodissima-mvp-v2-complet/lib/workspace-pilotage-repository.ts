import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getGovernancePilotage } from "@/lib/governance-pilotage-repository";
import { filterSignalsByWorkspaceId, isInterventionSignalKind, summarizeGovernanceAttention } from "@/lib/governance-attention";

export const WORKSPACE_RECENT_DAYS = 14;
export const WORKSPACE_COMMUNICATION_LIMIT = 10;
const communicationSelect = {
  id: true, title: true, scheduledAt: true, updatedAt: true, status: true,
  relationCase: { select: { id: true, ownerId: true, candidateName: true } },
  relationTemplate: { select: { name: true, workspace: { select: { ownerId: true } },
    formTemplates: { orderBy: { createdAt: "asc" as const }, take: 1, select: { id: true } } } },
} satisfies Prisma.CommunicationSessionSelect;

type Session = Prisma.CommunicationSessionGetPayload<{ select: typeof communicationSelect }>;
function communicationItem(session: Session, ownerId: string) {
  // Destinations are owner surfaces only. Never infer a guest URL or standalone meeting page.
  const relationCase = session.relationCase?.ownerId === ownerId ? session.relationCase : null;
  const journey = session.relationTemplate?.workspace?.ownerId === ownerId ? session.relationTemplate : null;
  const formId = journey?.formTemplates[0]?.id;
  return {
    id: session.id, title: session.title, scheduledAt: session.scheduledAt, updatedAt: session.updatedAt, status: session.status,
    context: relationCase ? `Dossier : ${relationCase.candidateName}` : journey ? `Parcours : ${journey.name}` : "Communication de cet espace",
    href: relationCase ? `/cases/${encodeURIComponent(relationCase.id)}` : formId ? `/gouvernance/parcours/${encodeURIComponent(formId)}/pilotage` : null,
  };
}

export async function getWorkspacePilotage(ownerId: string, workspaceId: string, now = new Date()) {
  // DIRECT: the recorded workspaceId wins, including when a journey has since moved.
  // No GLINK_FALLBACK, no null-workspace inheritance and no reassignment through a journey.
  const direct = { ownerId, workspaceId, workspace: { ownerId } };
  const since = new Date(now.getTime() - WORKSPACE_RECENT_DAYS * 86400000);
  const [pilotage, upcoming, recent] = await Promise.all([
    // Existing deterministic engine, SQL-scoped. PARCOURS context also requires DIRECT children.
    getGovernancePilotage(ownerId, undefined, workspaceId, now),
    prisma.communicationSession.findMany({
      where: { ...direct, scheduledAt: { gt: now }, status: { notIn: ["CANCELLED", "COMPLETED"] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: WORKSPACE_COMMUNICATION_LIMIT, select: communicationSelect,
    }),
    prisma.communicationSession.findMany({
      where: { ...direct, updatedAt: { gte: since, lte: now } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: WORKSPACE_COMMUNICATION_LIMIT, select: communicationSelect,
    }),
  ]);
  const signals = [...new Map(filterSignalsByWorkspaceId(pilotage.signals, workspaceId)
    .filter(signal => isInterventionSignalKind(signal.kind)).map(signal => [signal.id, signal])).values()];
  const attention = summarizeGovernanceAttention({ signals, scope: "WORKSPACE", scopeId: workspaceId,
    fallbackHref: `/gouvernance/workspaces/${encodeURIComponent(workspaceId)}#attention` });
  return { signals, attention, upcoming: upcoming.map(row => communicationItem(row, ownerId)), recent: recent.map(row => communicationItem(row, ownerId)) };
}
export type WorkspacePilotage = Awaited<ReturnType<typeof getWorkspacePilotage>>;
