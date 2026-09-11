import { linkObjectLabel } from "@/lib/object-creation";
import { resolveCandidateIdentityState } from "@/lib/candidate-identity";
import { prisma } from "@/lib/prisma";
import { getTemplateCreationProofWhere, resolveTemplateAccess, templateAccessSelect } from "@/lib/relation-template-access";
import { organizeWindow, organizeResults } from "@/lib/unassigned-pagination";
import type {
  CommunicationChannelType,
  CommunicationProvider,
  CommunicationSessionStatus,
  LinkStatus,
  RelationStatus,
  WorkspaceCategory,
  WorkspaceKind,
} from "@prisma/client";

export const workspaceCategoryLabels: Record<WorkspaceCategory, string> = {
  PROFESSIONAL: "Professionnel",
  PRIVATE: "Prive",
  FAMILY: "Famille",
  ASSOCIATION: "Association",
  PROJECT: "Projet",
  CLIENT: "Client",
  OTHER: "Autre",
};

export const workspaceKindLabels: Record<WorkspaceKind, string> = {
  GOVERNANCE: "Gouvernance",
  RELATION: "Relation",
  MIXED: "Mixte",
};

export type RealGovernanceJourneySummary = {
  relationTemplateId: string;
  formTemplateId: string | null;
  name: string;
  href: string | null;
};

export type GovernanceWorkspaceRelationCaseSummary = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  status: RelationStatus;
  createdAt: Date;
  href: string;
  gLinkTitle: string;
  communicationsCount: number;
};

export type GovernanceWorkspaceGLinkSummary = {
  id: string;
  title: string;
  slug: string;
  status: LinkStatus;
  createdAt: Date;
  href: string;
  relationCaseCount: number;
};

export type RealGovernanceWorkspaceSummary = {
  workspaceId: string;
  slug: string;
  name: string;
  category: WorkspaceCategory;
  categoryLabel: string;
  kind: WorkspaceKind;
  kindLabel: string;
  href: string;
  journeyCount: number;
  relationCount: number;
  linkCount: number;
  communicationCount: number;
  preparedCommunicationCount: number;
  completedCommunicationCount: number;
  expiredCommunicationCount: number;
  totalObjects: number;
  state: "Actif" | "Archive";
  observation: string;
  journeys: RealGovernanceJourneySummary[];
  relationCases: GovernanceWorkspaceRelationCaseSummary[];
  gLinks: GovernanceWorkspaceGLinkSummary[];
  relationCommunicationCount: number;
};

export type GovernanceCommunicationSessionSummary = {
  id: string;
  channelType: CommunicationChannelType;
  channelLabel: string;
  provider: CommunicationProvider;
  providerLabel: string;
  status: CommunicationSessionStatus;
  statusLabel: string;
  title: string;
  purpose: string | null;
  note: string | null;
  externalUrl: string | null;
  scheduledAt: Date | null;
  createdAt: Date;
  transcriptionRequested: boolean;
  transcriptionConsented: boolean;
  recordingEnabled: boolean;
  automaticNotificationSent: boolean;
  tokenGenerated: boolean;
  accessOpened: boolean;
  workflowStarted: boolean;
};

export const communicationChannelLabels: Record<CommunicationChannelType, string> = {
  VOICE_IP: "Appel audio sécurisé",
  VIDEO_IP: "Visio sécurisée",
  SCREEN_SHARE: "Partage d'écran sécurisé",
};

export const communicationProviderLabels: Record<CommunicationProvider, string> = {
  NONE: "Aucun provider média branché en V1",
  MANUAL_EXTERNAL: "Lien externe manuel - non envoyé par Goodissima",
  LIVEKIT_PENDING: "LiveKit prévu - non branché en V1",
};

export const communicationStatusLabels: Record<CommunicationSessionStatus, string> = {
  REQUESTED: "Demandée",
  PREPARED_NOT_STARTED: "Préparée - non démarrée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

export type GovernanceWorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  categoryLabel: string;
  kindLabel: string;
};

export type UnassignedGovernedJourneySummary = {
  relationTemplateId: string;
  formTemplateId: string;
  title: string;
  createdAt: Date;
  href: string;
};

export type UnassignedRelationCaseSummary = GovernanceWorkspaceRelationCaseSummary & {
  gLinkId: string;
};

export type UnassignedGLinkSummary = GovernanceWorkspaceGLinkSummary & {
  unassignedRelationCaseCount: number;
  objectLabel: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getGovernanceWorkspaceOptions(ownerId: string, page?: number): Promise<GovernanceWorkspaceOption[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId, status: "ACTIVE" },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    ...(page === undefined ? {} : organizeWindow(page)),
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      kind: true,
    },
  });

  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    categoryLabel: workspaceCategoryLabels[workspace.category],
    kindLabel: workspaceKindLabels[workspace.kind],
  }));
}

export async function getRealGovernanceWorkspaceSummaries(ownerId: string): Promise<RealGovernanceWorkspaceSummary[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      relationTemplates: {
        orderBy: { createdAt: "desc" },
        include: {
          formTemplates: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      relationCases: {
        orderBy: { createdAt: "desc" },
        include: {
          gLink: {
            select: {
              title: true,
            },
          },
          _count: {
            select: {
              communicationSessions: true,
            },
          },
        },
      },
      links: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              cases: true,
            },
          },
        },
      },
      _count: {
        select: {
          relationTemplates: true,
          relationCases: true,
          links: true,
          communicationSessions: true,
        },
      },
      communicationSessions: {
        select: {
          status: true,
          expiresAt: true,
        },
      },
    },
  });

  return workspaces.map((workspace) => {
    const now = new Date();
    const preparedCommunicationCount = workspace.communicationSessions.filter(
      (session) =>
        (session.status === "REQUESTED" || session.status === "PREPARED_NOT_STARTED") &&
        (!session.expiresAt || session.expiresAt > now),
    ).length;
    const completedCommunicationCount = workspace.communicationSessions.filter((session) => session.status === "COMPLETED").length;
    const expiredCommunicationCount = workspace.communicationSessions.filter(
      (session) =>
        session.status === "CANCELLED" ||
        ((session.status === "REQUESTED" || session.status === "PREPARED_NOT_STARTED") &&
          Boolean(session.expiresAt && session.expiresAt <= now)),
    ).length;
    const journeys = workspace.relationTemplates.map((template) => {
      const formTemplate = template.formTemplates[0] ?? null;

      return {
        relationTemplateId: template.id,
        formTemplateId: formTemplate?.id ?? null,
        name: formTemplate?.name ?? template.name,
        href: formTemplate ? `/gouvernance/parcours/${formTemplate.id}/pilotage` : null,
      };
    });
    const totalObjects =
      workspace._count.relationTemplates +
      workspace._count.relationCases +
      workspace._count.links +
      workspace._count.communicationSessions;
    const relationCases = workspace.relationCases.map((relationCase) => ({
      id: relationCase.id,
      candidateName: relationCase.candidateName,
      candidateEmail: relationCase.candidateEmail,
      status: relationCase.status,
      createdAt: relationCase.createdAt,
      href: `/cases/${relationCase.id}`,
      gLinkTitle: relationCase.gLink.title,
      communicationsCount: relationCase._count.communicationSessions,
    }));
    const gLinks = workspace.links.map((link) => ({
      id: link.id,
      title: link.title,
      slug: link.slug,
      status: link.status,
      createdAt: link.createdAt,
      href: `/links/${link.id}`,
      relationCaseCount: link._count.cases,
    }));
    const relationCommunicationCount = relationCases.reduce(
      (total, relationCase) => total + relationCase.communicationsCount,
      0,
    );

    return {
      workspaceId: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      category: workspace.category,
      categoryLabel: workspaceCategoryLabels[workspace.category],
      kind: workspace.kind,
      kindLabel: workspaceKindLabels[workspace.kind],
      href: `/gouvernance/workspaces/${encodeURIComponent(workspace.id)}`,
      journeyCount: workspace._count.relationTemplates,
      relationCount: workspace._count.relationCases,
      linkCount: workspace._count.links,
      communicationCount: workspace._count.communicationSessions,
      preparedCommunicationCount,
      completedCommunicationCount,
      expiredCommunicationCount,
      totalObjects,
      state: workspace.status === "ARCHIVED" ? "Archive" : "Actif",
      observation:
        totalObjects > 0
          ? "Workspace persistant rattache a des objets Goodissima."
          : "Workspace persistant sans objet rattache pour le moment.",
      journeys,
      relationCases,
      gLinks,
      relationCommunicationCount,
    };
  });
}

export async function getGovernanceCommunicationSessionsForJourney(input: {
  ownerId: string;
  relationTemplateId: string;
}): Promise<GovernanceCommunicationSessionSummary[]> {
  const sessions = await prisma.communicationSession.findMany({
    where: {
      ownerId: input.ownerId,
      relationTemplateId: input.relationTemplateId,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      channelType: true,
      provider: true,
      status: true,
      title: true,
      purpose: true,
      note: true,
      externalUrl: true,
      scheduledAt: true,
      createdAt: true,
      transcriptionRequested: true,
      transcriptionConsented: true,
      recordingEnabled: true,
      automaticNotificationSent: true,
      tokenGenerated: true,
      accessOpened: true,
      workflowStarted: true,
    },
  });

  return sessions.map((session) => ({
    ...session,
    channelLabel: communicationChannelLabels[session.channelType],
    providerLabel: communicationProviderLabels[session.provider],
    statusLabel: communicationStatusLabels[session.status],
  }));
}

/** A bounded READ candidate window, including conflicting proofs for the final guard.
 * Pagination follows candidates, so a rejected row never hides later pages. */
export async function getUnassignedGovernedJourneySummaries(ownerId: string, page = 0) {
  const templates = await prisma.relationTemplate.findMany({
    where: { ...getTemplateCreationProofWhere(ownerId), formTemplates: { some: {} } },
    ...organizeWindow(page),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      ...templateAccessSelect, name: true, createdAt: true,
      formTemplates: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 1, select: { id: true, name: true } },
    },
  });
  const window = organizeResults(templates);
  return {
    hasMore: window.hasMore,
    items: window.items.filter(template => resolveTemplateAccess(ownerId, template).read).flatMap(template => {
      const form = template.formTemplates[0];
      if (!form) return [];
      return [{ relationTemplateId: template.id, formTemplateId: form.id, title: form.name || template.name,
        createdAt: template.createdAt, href: `/gouvernance/parcours/${encodeURIComponent(form.id)}/pilotage` }];
    }),
  };
}

export async function getUnassignedRelationCaseSummaries(ownerId: string, page = 0) {
  const rows = await prisma.relationCase.findMany({
    where: { ownerId, workspaceId: null }, ...organizeWindow(page),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, candidateName: true, candidateEmail: true, createdAt: true,
      gLink: { select: { id: true, title: true } } },
  });
  return organizeResults(rows.map(row => ({ id: row.id, title: resolveCandidateIdentityState(row).displayName,
    gLinkTitle: row.gLink.title, createdAt: row.createdAt, href: `/cases/${encodeURIComponent(row.id)}` })));
}

export async function getUnassignedGLinkSummaries(ownerId: string, page = 0) {
  const rows = await prisma.gLink.findMany({
    where: { ownerId, workspaceId: null }, ...organizeWindow(page),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, title: true, rules: true, status: true, createdAt: true },
  });
  return organizeResults(rows.map(row => ({ id: row.id, title: row.title, status: row.status, createdAt: row.createdAt,
    objectLabel: linkObjectLabel(row.rules), href: `/links/${encodeURIComponent(row.id)}` })));
}
