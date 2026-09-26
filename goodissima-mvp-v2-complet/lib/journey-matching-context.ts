import { prisma } from "./prisma.ts";

export type JourneyMatchingResultContext = {
  targetLinkId: string;
  targetLinkTitle: string;
  targetLinkHref: string;
  status: string;
  explanation: string[];
  invitableAsPerson: false;
  nonInvitableReason: string;
};

export type JourneyMatchingContext = {
  runId: string;
  sourceLinkId: string;
  sourceLinkTitle: string;
  sourceLinkHref: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  resultCount: number;
  belongsToCurrentJourney: boolean;
  results: JourneyMatchingResultContext[];
};

type MatchingContextClient = Pick<typeof prisma, "governedJourney" | "matchingRun">;

const nonInvitableReason = "Ce résultat correspond à un Lien et ne permet pas d’identifier avec certitude une personne à inviter.";

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

export function projectSafeMatchingExplanation(value: unknown): string[] {
  if (typeof value === "string") return safeText(value) ? [safeText(value)] : [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const fields = ["compatibleElements", "semanticSignals", "clarificationsNeeded", "warnings"];
  const projected = fields.flatMap((field) => Array.isArray(record[field]) ? (record[field] as unknown[]).map(safeText).filter(Boolean).slice(0, 4) : []);
  if (projected.length) return [...new Set(projected)].slice(0, 8);
  return safeText(record.summary) ? [safeText(record.summary)] : [];
}

export async function getMatchingContextForJourneyParticipantPicker(
  input: { currentUserId: string; governedJourneyId: string },
  client: MatchingContextClient = prisma,
): Promise<JourneyMatchingContext[]> {
  const journey = await client.governedJourney.findFirst({
    where: { id: input.governedJourneyId, authorityUserId: input.currentUserId, status: { notIn: ["CLOSED", "CANCELLED"] } },
    select: { relationTemplateId: true },
  });
  if (!journey) return [];

  const runs = await client.matchingRun.findMany({
    where: { ownerId: input.currentUserId, status: { in: ["RESULTS_AVAILABLE", "CLOSED"] }, results: { some: {} } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true, status: true, createdAt: true, completedAt: true,
      gLink: { select: { id: true, title: true, templateId: true } },
      results: {
        orderBy: [{ internalRank: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        select: { status: true, explanation: true, targetGLink: { select: { id: true, title: true } } },
      },
    },
  });

  return runs.map((run) => ({
    runId: run.id,
    sourceLinkId: run.gLink.id,
    sourceLinkTitle: run.gLink.title,
    sourceLinkHref: `/links/${run.gLink.id}`,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    status: run.status,
    resultCount: run.results.length,
    belongsToCurrentJourney: run.gLink.templateId === journey.relationTemplateId,
    results: run.results.map((result) => ({
      targetLinkId: result.targetGLink.id,
      targetLinkTitle: result.targetGLink.title,
      targetLinkHref: `/links/${result.targetGLink.id}`,
      status: result.status,
      explanation: projectSafeMatchingExplanation(result.explanation),
      invitableAsPerson: false as const,
      nonInvitableReason,
    })),
  })).sort((left, right) => Number(right.belongsToCurrentJourney) - Number(left.belongsToCurrentJourney));
}
