export type HumanizedEvent = {
  title: string;
  description?: string;
  category?: "IA" | "Matching" | "Documents" | "Conversation" | "Validation" | "Dossier";
  icon?: string;
};

type EventPayload = Record<string, unknown> | null | undefined;

function getPayloadBoolean(payload: EventPayload, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return typeof payload[key] === "boolean" ? payload[key] : null;
}

function technicalFallback(eventType: string): HumanizedEvent {
  return {
    title: eventType
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    description: "Evenement technique conserve pour audit interne.",
    category: "Dossier",
    icon: "dot",
  };
}

export function humanizeRelationEvent(eventType: string, payload?: EventPayload): HumanizedEvent {
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
        title: "Demande de document creee",
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
    case "AI_SUGGESTED_ACTION_ACCEPTED":
      return {
        title: "Suggestion IA acceptee",
        description: "Une suggestion IA a ete acceptee par un utilisateur.",
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
    default:
      return technicalFallback(eventType);
  }
}

export function humanizeAIEvent(action: string): HumanizedEvent {
  switch (action) {
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
      return technicalFallback(action);
  }
}
