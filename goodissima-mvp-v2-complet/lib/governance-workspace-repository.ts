import { prisma } from "@/lib/prisma";
import type {
  CommunicationChannelType,
  CommunicationProvider,
  CommunicationSessionStatus,
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
  totalObjects: number;
  state: "Actif" | "Archive";
  observation: string;
  journeys: RealGovernanceJourneySummary[];
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getGovernanceWorkspaceOptions(ownerId: string): Promise<GovernanceWorkspaceOption[]> {
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId, status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
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
      _count: {
        select: {
          relationTemplates: true,
          relationCases: true,
          links: true,
          communicationSessions: true,
        },
      },
    },
  });

  return workspaces.map((workspace) => {
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
    const firstJourneyHref = journeys.find((journey) => journey.href)?.href;

    return {
      workspaceId: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      category: workspace.category,
      categoryLabel: workspaceCategoryLabels[workspace.category],
      kind: workspace.kind,
      kindLabel: workspaceKindLabels[workspace.kind],
      href: firstJourneyHref ?? "/gouvernance",
      journeyCount: workspace._count.relationTemplates,
      relationCount: workspace._count.relationCases,
      linkCount: workspace._count.links,
      communicationCount: workspace._count.communicationSessions,
      totalObjects,
      state: workspace.status === "ARCHIVED" ? "Archive" : "Actif",
      observation:
        totalObjects > 0
          ? "Workspace persistant rattache a des objets Goodissima."
          : "Workspace persistant sans objet rattache pour le moment.",
      journeys,
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

export async function getUnassignedGovernedJourneySummaries(ownerId: string): Promise<UnassignedGovernedJourneySummary[]> {
  const templates = await prisma.relationTemplate.findMany({
    where: {
      workspaceId: null,
      versions: {
        some: {
          snapshot: {
            path: ["metadata", "source"],
            equals: "governance-v1-minimal-create",
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      formTemplates: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
        },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          snapshot: true,
          createdAt: true,
        },
      },
    },
  });

  return templates
    .map((template) => {
      const latestVersion = template.versions[0];
      const metadata = asRecord(asRecord(latestVersion?.snapshot).metadata);
      const creationPlan = asRecord(metadata.creationPlan);
      const createdById = text(metadata.createdById);
      const formTemplate = template.formTemplates[0] ?? null;

      if (createdById !== ownerId || !formTemplate || !latestVersion) return null;

      return {
        relationTemplateId: template.id,
        formTemplateId: formTemplate.id,
        title: text(creationPlan.title) ?? formTemplate.name ?? template.name,
        createdAt: latestVersion.createdAt,
        href: `/gouvernance/parcours/${formTemplate.id}/pilotage`,
      };
    })
    .filter((item): item is UnassignedGovernedJourneySummary => item !== null);
}
