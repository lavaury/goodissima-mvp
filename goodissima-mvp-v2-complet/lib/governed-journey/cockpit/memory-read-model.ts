import { createHash } from "node:crypto";
import type {
  GovernedMemoryDecisionStatus,
  GovernedMemoryFactStatus,
  GovernedMemorySourceKind,
  GovernedMemorySourceStatus,
  GovernedMemoryTargetType,
  GovernedMemoryValidationDecision,
} from "@prisma/client";

export type GovernedMemoryCockpitItem = {
  publicKey: string;
  content: { title: string | null; text: string };
  kindLabel: string;
  state: { code: string; label: string; isActive: boolean };
  recordedAt: string;
  provenance: { label: string; recordedAt: string | null } | null;
  humanValidation: { label: string; validatedAt: string } | null;
  disputeLabel: string | null;
  contextLabel: string | null;
};

export type GovernedMemoryCockpitView = {
  availability: "NO_EXTENSION" | "EMPTY" | "AVAILABLE";
  visibleCount: number;
  items: GovernedMemoryCockpitItem[];
};

export type GovernedMemoryCockpitRawItem = {
  id: string;
  type: GovernedMemoryTargetType;
  title: string | null;
  text: string;
  kind: GovernedMemorySourceKind | null;
  status: GovernedMemoryFactStatus | GovernedMemoryDecisionStatus | GovernedMemorySourceStatus;
  recordedAt: Date;
  sourceEventOccurredAt: Date | null;
  validation: { decision: GovernedMemoryValidationDecision; validatedAt: Date } | null;
  dispute: { status: "OPEN" | "RESOLVED" | "MAINTAINED" | "WITHDRAWN" } | null;
  hasExplicitContext: boolean;
};

const factStates: Record<GovernedMemoryFactStatus, { label: string; isActive: boolean }> = {
  PROPOSED: { label: "Proposée", isActive: false },
  ESTABLISHED: { label: "Établie", isActive: true },
  DISPUTED: { label: "Contestée", isActive: false },
  SUPERSEDED: { label: "Remplacée", isActive: false },
};
const decisionStates: Record<GovernedMemoryDecisionStatus, { label: string; isActive: boolean }> = {
  DRAFT: { label: "Brouillon enregistré", isActive: false },
  VALIDATED: { label: "Validée humainement", isActive: true },
  SUPERSEDED: { label: "Remplacée", isActive: false },
  CANCELLED: { label: "Annulée", isActive: false },
};
const sourceStates: Record<GovernedMemorySourceStatus, { label: string; isActive: boolean }> = {
  ACTIVE: { label: "Active", isActive: true },
  ARCHIVED: { label: "Archivée", isActive: false },
  RESTRICTED: { label: "Restreinte", isActive: false },
  EXPIRED: { label: "Expirée", isActive: false },
  ANONYMIZED: { label: "Anonymisée", isActive: false },
  DELETED: { label: "Supprimée logiquement", isActive: false },
  LEGAL_HOLD: { label: "Conservée sous obligation légale", isActive: true },
};
const kindLabels: Record<GovernedMemorySourceKind, string> = {
  DOCUMENT: "Document", DOCUMENT_VERSION: "Version de document", FORM_SUBMISSION: "Réponse de formulaire",
  MESSAGE_EXCERPT: "Extrait de message", SYSTEM_EVENT: "Événement système", HUMAN_DECLARATION: "Déclaration humaine",
  VALIDATED_SYNTHESIS: "Synthèse validée", EXTERNAL_IMPORT: "Import externe",
};
const validationLabels: Record<GovernedMemoryValidationDecision, string> = {
  APPROVED: "Approuvée humainement", PARTIALLY_APPROVED: "Partiellement approuvée humainement",
  REJECTED: "Rejetée humainement", WITH_RESERVATIONS: "Approuvée humainement avec réserves",
};
const disputeLabels = {
  OPEN: "Contestation ouverte", RESOLVED: "Contestation résolue",
  MAINTAINED: "Contestation maintenue", WITHDRAWN: "Contestation retirée",
} as const;

function stateFor(item: GovernedMemoryCockpitRawItem) {
  const projected = item.type === "FACT"
    ? factStates[item.status as GovernedMemoryFactStatus]
    : item.type === "DECISION"
      ? decisionStates[item.status as GovernedMemoryDecisionStatus]
      : sourceStates[item.status as GovernedMemorySourceStatus];
  return { code: item.status, ...projected };
}

function publicKey(type: GovernedMemoryTargetType, id: string) {
  return createHash("sha256").update(`governed-memory-cockpit:v1:${type}:${id}`, "utf8").digest("hex");
}

export function buildGovernedMemoryCockpitView(input: {
  hasExtension: boolean;
  items: GovernedMemoryCockpitRawItem[];
}): GovernedMemoryCockpitView {
  if (!input.hasExtension) return { availability: "NO_EXTENSION", visibleCount: 0, items: [] };
  const items = [...input.items]
    .sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime() || right.id.localeCompare(left.id))
    .map((item): GovernedMemoryCockpitItem => ({
      publicKey: publicKey(item.type, item.id),
      content: { title: item.title, text: item.text },
      kindLabel: item.type === "FACT" ? "Fait" : item.type === "DECISION" ? "Décision" : kindLabels[item.kind!],
      state: stateFor(item),
      recordedAt: item.recordedAt.toISOString(),
      provenance: {
        label: item.sourceEventOccurredAt ? "Issue d’un événement gouverné" : item.type === "SOURCE"
          ? "Enregistrée explicitement dans le parcours" : "Rattachée à une source du parcours",
        recordedAt: item.sourceEventOccurredAt?.toISOString() ?? null,
      },
      humanValidation: item.validation ? {
        label: validationLabels[item.validation.decision],
        validatedAt: item.validation.validatedAt.toISOString(),
      } : null,
      disputeLabel: item.dispute ? disputeLabels[item.dispute.status] : null,
      contextLabel: item.hasExplicitContext ? "Contexte dossier rattaché" : null,
    }));
  return { availability: items.length ? "AVAILABLE" : "EMPTY", visibleCount: items.length, items };
}
