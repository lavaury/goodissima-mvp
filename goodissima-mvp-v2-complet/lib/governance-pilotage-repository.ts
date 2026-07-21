import { prisma } from "@/lib/prisma";
import { hasUsefulGLinkMatchingCriteria } from "@/lib/ai/relational-matching-source";
import { deriveGLinkMatchingDisplayState, parseGLinkMatchingState } from "@/lib/glink-matching";
import { selectDeterministicMatchingSources, type PilotageSignalKind } from "@/lib/governance-attention";
export { filterSignalsByWorkspaceId, isInterventionSignalKind, summarizeGovernanceAttention } from "@/lib/governance-attention";

export type { PilotageSignalKind } from "@/lib/governance-attention";
export type GovernancePilotageSignal = { id: string; kind: PilotageSignalKind; title: string; subject: string; journey: string; workspaceId: string | null; workspace: string | null; portfolioId: string | null; portfolio: string | null; reason: string; actionLabel: string; href: string; date: Date | null };

function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function selectedParticipants(value: unknown) { const rows = record(value).selectedParticipants; return Array.isArray(rows) ? rows.map(record).map((row) => ({ name: typeof row.participantName === "string" ? row.participantName : "", role: typeof row.participantRole === "string" ? row.participantRole : "" })).filter((row) => row.name) : []; }

export async function getGovernancePilotage(ownerId: string, portfolioId?: string) {
  const [workspaces, gLinks] = await Promise.all([
    prisma.workspace.findMany({ where: { ownerId, ...(portfolioId ? { portfolioId } : {}) }, include: { portfolio: true, relationTemplates: { include: { formTemplates: { select: { id: true } }, governedJourneyInvitations: true, communicationSessions: { include: { meetingParticipants: true } }, relationCases: { select: { id: true, candidateName: true, matchingEnabled: true, embeddingStatus: true, embeddingUpdatedAt: true, createdAt: true, gLink: { select: { rules: true } }, aiEvents: { where: { action: { in: ["matching_analysis", "semantic_matching_analysis", "matching_proposed"] } }, orderBy: { createdAt: "desc" }, take: 10, select: { action: true, outputSummary: true, createdAt: true } }, relationEvents: { where: { type: "MATCHING_PROPOSED" }, orderBy: { createdAt: "desc" }, take: 10, select: { createdAt: true } } } }, links: { select: { id: true } } } } }, orderBy: { updatedAt: "desc" } }),
    prisma.gLink.findMany({
      where: { ownerId, status: "ACTIVE", ...(portfolioId ? { workspace: { portfolioId } } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, description: true, createdAt: true, templateId: true, rules: true,
        workspace: { select: { id: true, name: true, portfolioId: true, portfolio: { select: { name: true } } } },
        template: {
          select: {
            name: true,
            formTemplates: { take: 1, orderBy: { createdAt: "asc" }, select: { fields: { orderBy: [{ step: "asc" }, { position: "asc" }], select: { label: true, type: true, options: true, validationRules: true } } } },
            aiEvents: { where: { action: { in: ["glink_matching_analysis", "glink_matching_interested", "glink_matching_ignored", "glink_matching_enabled", "glink_matching_disabled"] } }, orderBy: { createdAt: "desc" }, take: 30, select: { action: true, outputSummary: true, createdAt: true } },
          },
        },
      },
    }),
  ]);
  const now = new Date(); const recentSince = new Date(now.getTime() - 14 * 86400000); const signals: GovernancePilotageSignal[] = [];
  for (const workspace of workspaces) for (const journey of workspace.relationTemplates) {
    const formId = journey.formTemplates[0]?.id; if (!formId) continue;
    const base = { journey: journey.name, workspaceId: workspace.id, workspace: workspace.name, portfolioId: workspace.portfolioId, portfolio: workspace.portfolio?.name ?? null };
    const href = `/gouvernance/parcours/${formId}/pilotage`;
    for (const relationCase of journey.relationCases) {
      if (!relationCase.matchingEnabled) continue;
      const historicalSource = selectDeterministicMatchingSources({ linkMatchingActive: parseGLinkMatchingState(relationCase.gLink.rules).enabled, linkHasUsefulCriteria: true, linkCaseCount: 1, historicalCaseMatchingCount: 1 });
      if (!historicalSource.includes("HISTORICAL_CASE")) continue;
      const analyses = relationCase.aiEvents.filter((event) => event.action === "matching_analysis" || event.action === "semantic_matching_analysis");
      const lastAnalysis = analyses[0];
      const stale = !lastAnalysis || relationCase.embeddingStatus === "stale" || Boolean(relationCase.embeddingUpdatedAt && lastAnalysis.createdAt < relationCase.embeddingUpdatedAt);
      const matchingHref = `/cases/${relationCase.id}#matching`;
      if (stale) signals.push({ id: `legacy-matching-analyze-${relationCase.id}`, kind: "MATCHING", title: "Capacité historique du dossier", subject: relationCase.candidateName, ...base, reason: lastAnalysis ? "Le contexte local du dossier a évolué depuis sa dernière analyse historique." : "Compatibilité historique activée sur ce dossier ; elle ne représente pas le matching global de la demande.", actionLabel: "Ouvrir le dossier", href: matchingHref, date: lastAnalysis?.createdAt ?? relationCase.createdAt });
      else {
        const counts = analyses.map((event) => Number(event.outputSummary?.match(/(\d+)\s+correspondance/)?.[1] ?? 0)); const potentialCount = Math.max(0, ...counts); const proposed = relationCase.relationEvents.filter((event) => event.createdAt >= lastAnalysis.createdAt);
        if (potentialCount > proposed.length) signals.push({ id: `legacy-matching-review-${relationCase.id}`, kind: "MATCHING", title: "Résultats historiques du dossier à examiner", subject: relationCase.candidateName, ...base, reason: `${potentialCount - proposed.length} correspondance(s) historique(s) à examiner localement, sans identité révélée.`, actionLabel: "Ouvrir le dossier", href: matchingHref, date: lastAnalysis.createdAt });
        if (proposed.length > 0) signals.push({ id: `legacy-matching-decide-${relationCase.id}`, kind: "MATCHING", title: "Décision historique du dossier", subject: relationCase.candidateName, ...base, reason: "Une correspondance historique du dossier attend une décision humaine locale.", actionLabel: "Ouvrir le dossier", href: matchingHref, date: proposed[0].createdAt });
      }
    }
    for (const invitation of journey.governedJourneyInvitations) {
      if (invitation.revokedAt) signals.push({ id: `revoked-${invitation.id}`, kind: "ACCESS", title: "Accès révoqué", subject: invitation.displayName, ...base, reason: "Cet accès ne permet plus de rejoindre le parcours ni ses réunions.", actionLabel: "Ouvrir le parcours", href, date: invitation.revokedAt });
      else if (invitation.accessTokenExpiresAt < now) signals.push({ id: `expired-${invitation.id}`, kind: "ACCESS", title: "Accès invité expiré", subject: invitation.displayName, ...base, reason: "Un nouvel accès doit être créé manuellement si cette personne participe encore.", actionLabel: "Créer un nouvel accès", href, date: invitation.accessTokenExpiresAt });
      else if ((invitation.status === "ACTIVE" || invitation.status === "PREPARED") && !invitation.acceptedAt) signals.push({ id: `deliver-${invitation.id}`, kind: "ACTION", title: "Lien invité à transmettre manuellement", subject: invitation.displayName, ...base, reason: "Le lien n’a pas encore été consulté. Il n’est plus réaffichable dans la salle de pilotage.", actionLabel: "Ouvrir le parcours", href, date: invitation.createdAt });
    }
    for (const meeting of journey.communicationSessions) {
      const meetingHref = `${href}#meeting-${meeting.id}`; const authorized = meeting.meetingParticipants.filter((participant) => participant.status === "AUTHORIZED");
      if (meeting.status === "PREPARED_NOT_STARTED") {
        signals.push({ id: `open-${meeting.id}`, kind: "ACTION", title: "Réunion préparée à ouvrir", subject: meeting.title, ...base, reason: "Cette réunion est prête mais n’a pas encore été ouverte.", actionLabel: "Ouvrir cette réunion", href: meetingHref, date: meeting.scheduledAt });
        if (!authorized.length) signals.push({ id: `scope-${meeting.id}`, kind: "ACTION", title: "Réunion sans invités autorisés", subject: meeting.title, ...base, reason: "Seul l’organisateur peut actuellement ouvrir cette réunion.", actionLabel: "Définir les participants", href: meetingHref, date: meeting.scheduledAt });
      }
      if (meeting.scheduledAt && meeting.scheduledAt > now && meeting.status !== "CANCELLED" && meeting.status !== "COMPLETED") signals.push({ id: `upcoming-${meeting.id}`, kind: "UPCOMING", title: "Réunion à venir", subject: meeting.title, ...base, reason: "Une date future est prévue dans le parcours.", actionLabel: "Ouvrir le détail", href: meetingHref, date: meeting.scheduledAt });
      if (meeting.status === "COMPLETED") signals.push({ id: `completed-${meeting.id}`, kind: "HISTORY", title: "Réunion terminée", subject: meeting.title, ...base, reason: "Réunion conservée en lecture seule dans l’historique.", actionLabel: "Consulter l’historique", href: meetingHref, date: meeting.updatedAt });
      if (meeting.status === "CANCELLED") signals.push({ id: `cancelled-${meeting.id}`, kind: "HISTORY", title: "Réunion annulée", subject: meeting.title, ...base, reason: "Réunion annulée et conservée dans l’historique.", actionLabel: "Consulter", href: meetingHref, date: meeting.updatedAt });
      if (meeting.createdAt >= recentSince || meeting.updatedAt >= recentSince) signals.push({ id: `recent-${meeting.id}`, kind: "RECENT", title: "Communication récente", subject: meeting.title, ...base, reason: "Communication créée ou mise à jour au cours des 14 derniers jours.", actionLabel: "Ouvrir le parcours", href: meetingHref, date: meeting.updatedAt });
      const activeNames = new Set(journey.governedJourneyInvitations.filter((item) => item.status === "ACTIVE" && !item.revokedAt && item.accessTokenExpiresAt > now).map((item) => item.displayName.toLocaleLowerCase("fr")));
      for (const participant of selectedParticipants(meeting.metadata)) if (!activeNames.has(participant.name.toLocaleLowerCase("fr"))) signals.push({ id: `missing-${meeting.id}-${participant.name}`, kind: "ACTION", title: "Participant sans accès actif", subject: participant.name, ...base, reason: `Sélectionné pour « ${meeting.title} », mais aucun accès invité actif ne correspond.`, actionLabel: "Créer ou renouveler l’accès invité", href: meetingHref, date: meeting.scheduledAt });
    }
  }
  for (const link of gLinks) {
    if (!link.template || !parseGLinkMatchingState(link.rules).enabled) continue;
    const source = {
      sourceType: "GLINK" as const, sourceId: link.id, ownerId, title: link.title, description: link.description,
      fields: link.template.formTemplates[0]?.fields ?? [],
    };
    if (!hasUsefulGLinkMatchingCriteria(source)) continue;
    const base = {
      journey: link.template.name,
      workspaceId: link.workspace?.id ?? null,
      workspace: link.workspace?.name ?? null,
      portfolioId: link.workspace?.portfolioId ?? null,
      portfolio: link.workspace?.portfolio?.name ?? null,
    };
    const href = `/links/${link.id}#matching`;
    const matchingState = deriveGLinkMatchingDisplayState({ rules: link.rules, sourceId: link.id, events: link.template.aiEvents });
    if (matchingState.status === "TO_ANALYZE") {
      signals.push({
        id: `GLINK:${link.id}:MATCHING_TO_ANALYZE`, kind: "MATCHING", title: "Matching du lien", subject: link.title,
        ...base, reason: "Le besoin défini dans ce lien peut être comparé aux opportunités existantes. Aucun contact automatique.",
        actionLabel: "Analyser le matching", href, date: link.createdAt,
      });
      continue;
    }
    const latestAnalysisDate = link.template.aiEvents.find((event) => event.action === "glink_matching_analysis")?.createdAt ?? link.createdAt;
    if (matchingState.status === "MATCHES_TO_REVIEW") signals.push({
      id: `GLINK:${link.id}:MATCHES_TO_REVIEW`, kind: "MATCHING", title: "Résultats à examiner", subject: link.title,
      ...base, reason: `${matchingState.count} correspondance(s) potentielle(s) détectée(s) pour ce lien. Examen humain requis. Aucun contact automatique.`,
      actionLabel: "Examiner les correspondances", href, date: latestAnalysisDate,
    });
    if (matchingState.status === "FOLLOW_UP_TO_DECIDE") signals.push({
      id: `GLINK:${link.id}:MATCH_FOLLOW_UP_TO_DECIDE`, kind: "MATCHING", title: "Intervention humaine requise", subject: link.title,
      ...base, reason: "Une correspondance a été marquée intéressante. La suite reste à décider humainement. Aucun contact automatique.",
      actionLabel: "Ouvrir le matching", href, date: link.template.aiEvents.find((event) => event.action === "glink_matching_interested")?.createdAt ?? latestAnalysisDate,
    });
  }
  return { signals, workspaces: workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, status: workspace.status, portfolio: workspace.portfolio?.name ?? null, journeyCount: workspace.relationTemplates.length, caseCount: workspace.relationTemplates.reduce((sum, journey) => sum + journey.relationCases.length, 0), linkCount: workspace.relationTemplates.reduce((sum, journey) => sum + journey.links.length, 0) })), activeJourneyCount: workspaces.reduce((sum, workspace) => sum + workspace.relationTemplates.filter((journey) => journey.status !== "ARCHIVED").length, 0) };
}
