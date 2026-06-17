export type HumanizedEvent = {
  title: string;
  description?: string;
  category?: "IA" | "Matching" | "Documents" | "Conversation" | "Validation" | "Dossier";
  icon?: string;
};

type EventPayload = Record<string, unknown> | null | undefined;

export const auditEventLabels: Record<string, HumanizedEvent> = {
  AI_SUGGESTED_ACTION_ACCEPTED: {
    title: "Suggestion IA validee",
    description: "Une suggestion IA a ete validee par un utilisateur.",
    category: "IA",
    icon: "wand",
  },
  AI_SUGGESTED_ACTION_CREATED: {
    title: "Suggestion IA creee",
    description: "Une suggestion IA a ete preparee pour validation humaine.",
    category: "IA",
    icon: "wand",
  },
  DOCUMENT_REQUESTED: {
    title: "Demande de document",
    description: "Un document a ete demande pour completer le dossier.",
    category: "Documents",
    icon: "file-plus",
  },
  DOCUMENT_RECEIVED: {
    title: "Document recu",
    description: "Un document demande a ete recu.",
    category: "Documents",
    icon: "file",
  },
  RELATIONSHIP_REQUEST_CREATED: {
    title: "Demande de mise en relation",
    description: "Une demande de mise en relation a ete creee.",
    category: "Matching",
    icon: "link",
  },
  RELATIONSHIP_ACCEPTED: {
    title: "Mise en relation acceptee",
    description: "Une mise en relation a ete acceptee.",
    category: "Matching",
    icon: "link",
  },
  TEMPLATE_PUBLISHED: {
    title: "Parcours publie",
    description: "Un parcours a ete publie apres validation.",
    category: "Dossier",
    icon: "check",
  },
};

function getPayloadBoolean(payload: EventPayload, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return typeof payload[key] === "boolean" ? payload[key] : null;
}

function technicalFallback(eventType: string, includeRaw = false): HumanizedEvent {
  return {
    title: includeRaw ? eventType : "Evenement du dossier",
    description: includeRaw
      ? "Code technique conserve pour audit interne."
      : "Evenement enregistre dans l'historique du dossier.",
    category: "Dossier",
    icon: "dot",
  };
}

export function humanizeRelationEvent(eventType: string, payload?: EventPayload, options?: { includeRaw?: boolean }): HumanizedEvent {
  const sharedLabel = auditEventLabels[eventType];
  if (sharedLabel) return sharedLabel;

  switch (eventType) {
    case "MESSAGE_SENT":
      return {
        title: "Message envoye",
        description: "Un message a ete ajoute a la conversation.",
        category: "Conversation",
        icon: "message",
      };
    case "DOCUMENT_UPLOADED":
      return {
        title: "Document ajoute",
        description: "Un document a ete ajoute au dossier.",
        category: "Documents",
        icon: "file",
      };
    case "DOCUMENT_REQUEST_CREATED":
    case "ACTION_CREATED":
      return {
        title: "Demande de document",
        description: "Une demande a ete creee pour faire avancer le dossier.",
        category: "Documents",
        icon: "file-plus",
      };
    case "ACTION_COMPLETED":
      return {
        title: "Demande traitee",
        description: "Une demande du dossier a ete marquee comme traitee.",
        category: "Validation",
        icon: "check",
      };
    case "MATCHING_OPT_IN_CHANGED": {
      const enabled = getPayloadBoolean(payload, "enabled");
      return {
        title: enabled === false ? "Matching relationnel desactive" : "Matching relationnel active",
        description: "La preference de matching du dossier a ete mise a jour.",
        category: "Matching",
        icon: "link",
      };
    }
    case "MATCHING_PROPOSED":
      return {
        title: "Correspondance relationnelle proposee",
        description: "Une suggestion relationnelle a ete creee sans revelation automatique d'identite.",
        category: "Matching",
        icon: "spark",
      };
    case "AI_DRAFT_USED":
      return {
        title: "Brouillon IA utilise",
        description: "Un brouillon IA a ete place dans l'editeur avant validation humaine.",
        category: "IA",
        icon: "pen",
      };
    case "AI_TIMELINE_SUGGESTION_ACCEPTED":
      return {
        title: "Suggestion IA de timeline acceptee",
        description: "Une suggestion IA a ete transformee en action apres validation humaine.",
        category: "IA",
        icon: "wand",
      };
    case "STATUS_CHANGED":
      return {
        title: "Statut du dossier modifie",
        category: "Validation",
        icon: "refresh",
      };
    case "PRIORITY_CHANGED":
      return {
        title: "Priorite du dossier modifiee",
        category: "Validation",
        icon: "flag",
      };
    case "CASE_ARCHIVED":
      return {
        title: "Dossier archive",
        category: "Dossier",
        icon: "archive",
      };
    case "CASE_RESTORED":
      return {
        title: "Dossier reactive",
        category: "Dossier",
        icon: "refresh",
      };
    case "GOVERNANCE_STATUS_CHANGED":
      return {
        title: "Gouvernance relationnelle modifiee",
        category: "Validation",
        icon: "shield",
      };
    default:
      return technicalFallback(eventType, options?.includeRaw);
  }
}

export function humanizeAIEvent(action: string, options?: { includeRaw?: boolean }): HumanizedEvent {
  const sharedLabel = auditEventLabels[action];
  if (sharedLabel) return sharedLabel;

  switch (action) {
    case "ACCESS_INVITATION_CREATED":
      return {
        title: "Invitation creee",
        category: "Dossier",
        icon: "mail-plus",
      };
    case "ACCESS_INVITATION_ACCEPTED":
      return {
        title: "Invitation acceptee",
        category: "Dossier",
        icon: "mail-check",
      };
    case "ACCESS_INVITATION_REVOKED":
      return {
        title: "Invitation revoquee",
        category: "Dossier",
        icon: "mail-x",
      };
    case "DOCUMENT_UPLOADED":
      return {
        title: "Document ajoute",
        category: "Documents",
        icon: "file",
      };
    case "CASE_CLOSED":
      return {
        title: "Relation cloturee",
        category: "Validation",
        icon: "check",
      };
    case "CASE_ARCHIVED":
      return {
        title: "Dossier archive",
        category: "Dossier",
        icon: "archive",
      };
    case "CASE_RESTORED":
      return {
        title: "Dossier reactive",
        category: "Dossier",
        icon: "refresh",
      };
    case "CANDIDATE_ACCESS_REVOKED":
      return {
        title: "Acces utilisateur bloque",
        category: "Dossier",
        icon: "lock",
      };
    case "CANDIDATE_ACCESS_REGENERATED":
      return {
        title: "Acces utilisateur regenere",
        category: "Dossier",
        icon: "key",
      };
    case "DEBUG_TEST_CASE_CREATED":
      return {
        title: "Action administrative executee",
        category: "Dossier",
        icon: "tool",
      };
    case "GOVERNANCE_STATUS_CHANGED":
      return {
        title: "Gouvernance relationnelle modifiee",
        category: "Validation",
        icon: "shield",
      };
    case "semantic_matching_analysis":
      return {
        title: "Analyse semantique des correspondances effectuee",
        category: "Matching",
        icon: "spark",
      };
    case "risk_analysis":
      return {
        title: "Analyse IA des signaux de confiance effectuee",
        category: "IA",
        icon: "shield",
      };
    case "draft_generation":
      return {
        title: "Brouillon IA genere",
        category: "IA",
        icon: "pen",
      };
    case "timeline_intelligence":
      return {
        title: "Analyse IA de la timeline effectuee",
        category: "IA",
        icon: "timeline",
      };
    case "matching_analysis":
      return {
        title: "Analyse des correspondances effectuee",
        category: "Matching",
        icon: "link",
      };
    default:
      return technicalFallback(action, options?.includeRaw);
  }
}
