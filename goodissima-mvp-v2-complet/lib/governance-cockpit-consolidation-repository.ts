import type {
  CommunicationChannelType,
  CommunicationProvider,
  CommunicationSessionStatus,
  LinkStatus,
  RelationGovernanceStatus,
  RelationStatus,
  WorkspaceCategory,
  WorkspaceKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  governanceCommunicationChannelLabels,
  governanceCommunicationProviderLabels,
  governanceCommunicationStatusLabel,
} from "@/lib/governance-communication-session-repository";
import { workspaceCategoryLabels, workspaceKindLabels } from "@/lib/governance-workspace-repository";

type InterventionLevel = "ATTENTION" | "INFO";
type CommunicationOrigin = "GOVERNANCE_PREPARATION" | "RELATION_CASE";
type RelationCaseAttachment = "DIRECT" | "GLINK_FALLBACK";

export type ConsolidatedWorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  category: WorkspaceCategory;
  categoryLabel: string;
  kind: WorkspaceKind;
  kindLabel: string;
  journeyCount: number;
  relationCaseCount: number;
  gLinkCount: number;
  communicationCount: number;
};

export type ConsolidatedJourneySummary = {
  formTemplateId: string;
  relationTemplateId: string;
  title: string;
  humanValidated: boolean;
  participantCount: number;
  participantInvitationCount: number;
  documentReceptionCount: number;
  governanceReviewPreparationCount: number;
};

export type ConsolidatedRelationCase = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: RelationStatus;
  governanceStatus: RelationGovernanceStatus;
  createdAt: Date;
  href: string;
  gLinkTitle: string;
  communicationsCount: number;
  attachment: RelationCaseAttachment;
};

export type ConsolidatedGLink = {
  id: string;
  title: string;
  slug: string;
  status: LinkStatus;
  createdAt: Date;
  href: string;
  relationCaseCount: number;
};

export type ConsolidatedCommunication = {
  id: string;
  origin: CommunicationOrigin;
  originLabel: string;
  relationCaseId: string | null;
  relationCaseLabel: string | null;
  relationCaseHref: string | null;
  channelType: CommunicationChannelType;
  channelLabel: string;
  provider: CommunicationProvider;
  providerLabel: string;
  status: CommunicationSessionStatus;
  statusLabel: string;
  title: string;
  purpose: string | null;
  createdAt: Date;
  scheduledAt: Date | null;
  expiresAt: Date | null;
  endedAt: Date | null;
};

export type HumanInterventionSignal = {
  id: string;
  title: string;
  description: string;
  source: string;
  href: string;
  actionLabel: string;
  level: InterventionLevel;
};

export type GovernanceCockpitConsolidation = {
  workspace: ConsolidatedWorkspaceSummary | null;
  journey: ConsolidatedJourneySummary;
  relationCases: ConsolidatedRelationCase[];
  gLinks: ConsolidatedGLink[];
  communications: ConsolidatedCommunication[];
  governanceCommunications: ConsolidatedCommunication[];
  relationCommunications: ConsolidatedCommunication[];
  preparedCommunicationCount: number;
  completedCommunicationCount: number;
  expiredCommunicationCount: number;
  activeCommunicationCount: number;
  humanInterventions: HumanInterventionSignal[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function participantKey(input: { name: string; role: string }) {
  return `${input.name.trim().toLowerCase()}::${input.role.trim().toLowerCase()}`;
}

function participantsFrom(value: unknown) {
  return arrayValue(value)
    .map((item) => {
      const row = asRecord(item);
      const name = text(row.name);
      const role = text(row.role) ?? "Participant attendu";
      return name ? { name, role } : null;
    })
    .filter((item): item is { name: string; role: string } => item !== null);
}

function participantInvitationsFrom(value: unknown) {
  return arrayValue(value)
    .map((item) => {
      const row = asRecord(item);
      const invitationId = text(row.invitationId);
      const participantName = text(row.participantName);
      const participantRole = text(row.participantRole);
      return invitationId && participantName && participantRole
        ? { invitationId, participantName, participantRole }
        : null;
    })
    .filter((item): item is { invitationId: string; participantName: string; participantRole: string } => item !== null);
}

function communicationOrigin(session: { relationCaseId: string | null }) {
  return session.relationCaseId ? "RELATION_CASE" : "GOVERNANCE_PREPARATION";
}

function isPreparedStatus(statusLabel: string) {
  return statusLabel === "Preparee - non demarree" || statusLabel === "En cours";
}

export async function getGovernanceCockpitConsolidation(input: {
  ownerId: string;
  formTemplateId: string;
}): Promise<GovernanceCockpitConsolidation | null> {
  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: input.formTemplateId },
    include: {
      relationTemplate: {
        include: {
          workspace: {
            include: {
              _count: {
                select: {
                  relationTemplates: true,
                },
              },
            },
          },
          formTemplates: {
            select: { id: true },
          },
          versions: {
            orderBy: { version: "desc" },
            take: 1,
            select: {
              snapshot: true,
            },
          },
        },
      },
    },
  });

  if (!formTemplate?.relationTemplate) return null;

  const latestVersion = formTemplate.relationTemplate.versions[0];
  const snapshot = asRecord(latestVersion?.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const creationPlan = asRecord(metadata.creationPlan);
  const metadataOwnerId = text(metadata.createdById);
  const workspace = formTemplate.relationTemplate.workspace;

  if (metadataOwnerId !== input.ownerId && workspace?.ownerId !== input.ownerId) {
    return null;
  }

  const participants = participantsFrom(creationPlan.participants ?? creationPlan.actors);
  const participantInvitations = participantInvitationsFrom(metadata.participantInvitations);
  const participantInvitationKeys = new Set(
    participantInvitations.map((invitation) =>
      participantKey({ name: invitation.participantName, role: invitation.participantRole }),
    ),
  );
  const documentReceptions = arrayValue(metadata.documentReceptions);
  const governanceReviewPreparations = arrayValue(metadata.governanceReviewPreparations);
  const relationTemplateId = formTemplate.relationTemplate.id;
  const workspaceId = workspace?.id ?? null;

  const [relationCases, gLinks] = workspaceId
    ? await Promise.all([
        prisma.relationCase.findMany({
          where: {
            ownerId: input.ownerId,
            OR: [
              { workspaceId },
              {
                workspaceId: null,
                gLink: {
                  ownerId: input.ownerId,
                  workspaceId,
                },
              },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            gLink: {
              select: {
                title: true,
                workspaceId: true,
              },
            },
            _count: {
              select: {
                communicationSessions: true,
              },
            },
          },
        }),
        prisma.gLink.findMany({
          where: {
            ownerId: input.ownerId,
            workspaceId,
          },
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: {
                cases: true,
              },
            },
          },
        }),
      ])
    : [[], []];

  const relationCaseIds = relationCases.map((relationCase) => relationCase.id);
  const communications = await prisma.communicationSession.findMany({
    where: {
      ownerId: input.ownerId,
      OR: [
        { relationTemplateId },
        ...(workspaceId ? [{ workspaceId }] : []),
        ...(relationCaseIds.length > 0 ? [{ relationCaseId: { in: relationCaseIds } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      relationCaseId: true,
      relationTemplateId: true,
      channelType: true,
      provider: true,
      status: true,
      title: true,
      purpose: true,
      scheduledAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      accessOpened: true,
    },
  });

  const relationCaseById = new Map(relationCases.map((relationCase) => [relationCase.id, relationCase]));
  const consolidatedCommunications = Array.from(new Map(communications.map((session) => [session.id, session])).values()).map(
    (session): ConsolidatedCommunication => {
      const statusLabel = governanceCommunicationStatusLabel({
        status: session.status,
        expiresAt: session.expiresAt,
        provider: session.provider,
        accessOpened: session.accessOpened,
      });
      const relationCase = session.relationCaseId ? relationCaseById.get(session.relationCaseId) : null;
      const origin = communicationOrigin(session);

      return {
        id: session.id,
        origin,
        originLabel:
          origin === "RELATION_CASE"
            ? "Tenue dans un dossier relationnel"
            : "Preparee dans la gouvernance",
        relationCaseId: session.relationCaseId,
        relationCaseLabel: relationCase
          ? `${relationCase.candidateName || relationCase.candidateEmail} - ${relationCase.gLink.title}`
          : null,
        relationCaseHref: relationCase ? `/cases/${relationCase.id}` : null,
        channelType: session.channelType,
        channelLabel: governanceCommunicationChannelLabels[session.channelType],
        provider: session.provider,
        providerLabel: governanceCommunicationProviderLabels[session.provider],
        status: session.status,
        statusLabel,
        title: session.title,
        purpose: session.purpose,
        createdAt: session.createdAt,
        scheduledAt: session.scheduledAt,
        expiresAt: session.expiresAt,
        endedAt: session.status === "COMPLETED" ? session.updatedAt : null,
      };
    },
  );

  const consolidatedRelationCases = relationCases.map((relationCase): ConsolidatedRelationCase => ({
    id: relationCase.id,
    candidateName: relationCase.candidateName,
    candidateEmail: relationCase.candidateEmail,
    status: relationCase.status,
    governanceStatus: relationCase.governanceStatus,
    createdAt: relationCase.createdAt,
    href: `/cases/${relationCase.id}`,
    gLinkTitle: relationCase.gLink.title,
    communicationsCount: relationCase._count.communicationSessions,
    attachment: relationCase.workspaceId === workspaceId ? "DIRECT" : "GLINK_FALLBACK",
  }));

  const consolidatedGLinks = gLinks.map((link): ConsolidatedGLink => ({
    id: link.id,
    title: link.title,
    slug: link.slug,
    status: link.status,
    createdAt: link.createdAt,
    href: `/links/${link.id}`,
    relationCaseCount: link._count.cases,
  }));

  const humanInterventions: HumanInterventionSignal[] = [];
  const cockpitHref = `/gouvernance/parcours/${input.formTemplateId}/pilotage`;

  if (asRecord(metadata.humanValidation).humanValidated !== true) {
    humanInterventions.push({
      id: "journey-human-validation",
      title: "Parcours gouverne - validation humaine requise",
      description: "Le parcours n'a pas encore de validation humaine enregistree dans ses metadata.",
      source: "Parcours gouverne",
      href: cockpitHref,
      actionLabel: "Ouvrir le cockpit",
      level: "ATTENTION",
    });
  }

  for (const participant of participants) {
    if (!participantInvitationKeys.has(participantKey(participant))) {
      humanInterventions.push({
        id: `participant-without-invitation-${participantKey(participant)}`,
        title: "Participant attendu - invitation a preparer",
        description: `${participant.name} (${participant.role}) est attendu dans le parcours sans invitation preparee.`,
        source: "Participants attendus",
        href: cockpitHref,
        actionLabel: "Preparer manuellement",
        level: "ATTENTION",
      });
    }
  }

  for (const invitation of participantInvitations) {
    humanInterventions.push({
      id: `invitation-${invitation.invitationId}`,
      title: "Invitation preparee - transmission manuelle requise",
      description: `${invitation.participantName} (${invitation.participantRole}) dispose d'une invitation preparee a transmettre humainement.`,
      source: "Invitations du parcours",
      href: cockpitHref,
      actionLabel: "Voir le brouillon",
      level: "INFO",
    });
  }

  for (const [index] of documentReceptions.entries()) {
    humanInterventions.push({
      id: `document-reception-${index}`,
      title: "Document declare recu - revue humaine requise",
      description: "Une reception documentaire est declaree dans les metadata du parcours.",
      source: "Documents attendus",
      href: cockpitHref,
      actionLabel: "Revoir la declaration",
      level: "INFO",
    });
  }

  for (const [index] of governanceReviewPreparations.entries()) {
    humanInterventions.push({
      id: `governance-review-${index}`,
      title: "Revue de gouvernance preparee - non lancee automatiquement",
      description: "Une revue est preparee dans le cockpit et reste a conduire humainement.",
      source: "Revue de gouvernance",
      href: cockpitHref,
      actionLabel: "Ouvrir la revue",
      level: "INFO",
    });
  }

  for (const communication of consolidatedCommunications.filter(
    (session) => session.origin === "GOVERNANCE_PREPARATION" && isPreparedStatus(session.statusLabel),
  )) {
    humanInterventions.push({
      id: `governance-communication-${communication.id}`,
      title: "Communication gouvernee preparee - aucun media multi-acteurs lance",
      description: `${communication.channelLabel} : ${communication.title}`,
      source: "Communications gouvernees",
      href: cockpitHref,
      actionLabel: "Voir la preparation",
      level: "INFO",
    });
  }

  for (const relationCase of consolidatedRelationCases.filter((item) => item.status !== "CLOSED" && item.status !== "ARCHIVED")) {
    humanInterventions.push({
      id: `active-relation-case-${relationCase.id}`,
      title: "Dossier relationnel actif - ouvrir le dossier",
      description: `${relationCase.candidateName || relationCase.candidateEmail} est rattache au Workspace.`,
      source: "Dossiers relationnels",
      href: relationCase.href,
      actionLabel: "Ouvrir le dossier",
      level: "INFO",
    });

    if (relationCase.communicationsCount === 0) {
      humanInterventions.push({
        id: `relation-case-without-communication-${relationCase.id}`,
        title: "Dossier relationnel sans communication",
        description: `${relationCase.candidateName || relationCase.candidateEmail} n'a pas encore de communication relationnelle historisee.`,
        source: "Dossiers relationnels",
        href: relationCase.href,
        actionLabel: "Ouvrir le dossier",
        level: "INFO",
      });
    }
  }

  const governanceCommunications = consolidatedCommunications.filter((session) => session.origin === "GOVERNANCE_PREPARATION");
  const relationCommunications = consolidatedCommunications.filter((session) => session.origin === "RELATION_CASE");

  return {
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          category: workspace.category,
          categoryLabel: workspaceCategoryLabels[workspace.category],
          kind: workspace.kind,
          kindLabel: workspaceKindLabels[workspace.kind],
          journeyCount: workspace._count.relationTemplates,
          relationCaseCount: consolidatedRelationCases.length,
          gLinkCount: consolidatedGLinks.length,
          communicationCount: consolidatedCommunications.length,
        }
      : null,
    journey: {
      formTemplateId: formTemplate.id,
      relationTemplateId,
      title: text(creationPlan.title) ?? formTemplate.name,
      humanValidated: asRecord(metadata.humanValidation).humanValidated === true,
      participantCount: participants.length,
      participantInvitationCount: participantInvitations.length,
      documentReceptionCount: documentReceptions.length,
      governanceReviewPreparationCount: governanceReviewPreparations.length,
    },
    relationCases: consolidatedRelationCases,
    gLinks: consolidatedGLinks,
    communications: consolidatedCommunications,
    governanceCommunications,
    relationCommunications,
    preparedCommunicationCount: consolidatedCommunications.filter((session) => isPreparedStatus(session.statusLabel)).length,
    completedCommunicationCount: consolidatedCommunications.filter((session) => session.statusLabel === "Terminee").length,
    expiredCommunicationCount: consolidatedCommunications.filter((session) => session.statusLabel === "Expiree").length,
    activeCommunicationCount: consolidatedCommunications.filter((session) => session.statusLabel === "En cours").length,
    humanInterventions,
  };
}
