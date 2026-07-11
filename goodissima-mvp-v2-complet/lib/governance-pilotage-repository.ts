import { prisma } from "@/lib/prisma";

export type PilotageSignalKind = "ACTION" | "UPCOMING" | "ACCESS" | "RECENT" | "HISTORY";
export type GovernancePilotageSignal = { id: string; kind: PilotageSignalKind; title: string; subject: string; journey: string; workspace: string | null; portfolio: string | null; reason: string; actionLabel: string; href: string; date: Date | null };

function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function selectedParticipants(value: unknown) { const rows = record(value).selectedParticipants; return Array.isArray(rows) ? rows.map(record).map((row) => ({ name: typeof row.participantName === "string" ? row.participantName : "", role: typeof row.participantRole === "string" ? row.participantRole : "" })).filter((row) => row.name) : []; }

export async function getGovernancePilotage(ownerId: string) {
  const workspaces = await prisma.workspace.findMany({ where: { ownerId }, include: { portfolio: true, relationTemplates: { include: { formTemplates: { select: { id: true } }, governedJourneyInvitations: true, communicationSessions: { include: { meetingParticipants: true } }, relationCases: { select: { id: true } }, links: { select: { id: true } } } } }, orderBy: { updatedAt: "desc" } });
  const now = new Date(); const recentSince = new Date(now.getTime() - 14 * 86400000); const signals: GovernancePilotageSignal[] = [];
  for (const workspace of workspaces) for (const journey of workspace.relationTemplates) {
    const formId = journey.formTemplates[0]?.id; if (!formId) continue;
    const base = { journey: journey.name, workspace: workspace.name, portfolio: workspace.portfolio?.name ?? null };
    const href = `/gouvernance/parcours/${formId}/pilotage`;
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
  return { signals, workspaces: workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, status: workspace.status, portfolio: workspace.portfolio?.name ?? null, journeyCount: workspace.relationTemplates.length, caseCount: workspace.relationTemplates.reduce((sum, journey) => sum + journey.relationCases.length, 0), linkCount: workspace.relationTemplates.reduce((sum, journey) => sum + journey.links.length, 0) })), activeJourneyCount: workspaces.reduce((sum, workspace) => sum + workspace.relationTemplates.filter((journey) => journey.status !== "ARCHIVED").length, 0) };
}
