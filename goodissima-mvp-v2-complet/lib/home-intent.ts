export const HOME_INTENTS = [
  "RESUME_WORK", "CREATE_GOVERNED_JOURNEY", "CREATE_SIMPLE_LINK", "CREATE_OPPORTUNITY",
  "SEARCH_DIRECTORY", "OPEN_MY_SPACES", "OPEN_EXISTING_OBJECT", "UNKNOWN", "AMBIGUOUS",
] as const;

export type HomeIntent = (typeof HOME_INTENTS)[number];
export type HomeActionIntent = Exclude<HomeIntent, "UNKNOWN" | "AMBIGUOUS" | "OPEN_EXISTING_OBJECT">;
export type HomeIntentDestination = { href: string; label: string; kind: "NAVIGATION" | "CREATION" };

/** Only application-owned routes appear here. The model never supplies a destination. */
export const HOME_INTENT_DESTINATIONS: Readonly<Record<HomeActionIntent, HomeIntentDestination>> = {
  // HOME-RESUME-WORK-01: no reliable last-viewed object trace exists; use the honest Mes espaces fallback.
  RESUME_WORK: { href: "/gouvernance", label: "Ouvrir Mes espaces", kind: "NAVIGATION" },
  CREATE_GOVERNED_JOURNEY: { href: "/gouvernance/nouveau", label: "Créer un Parcours gouverné", kind: "CREATION" },
  CREATE_SIMPLE_LINK: { href: "/links/simple", label: "Créer un Lien simple", kind: "CREATION" },
  CREATE_OPPORTUNITY: { href: "/opportunities/new", label: "Créer une Opportunité", kind: "CREATION" },
  SEARCH_DIRECTORY: { href: "/annuaire", label: "Rechercher dans l’Annuaire", kind: "NAVIGATION" },
  OPEN_MY_SPACES: { href: "/gouvernance", label: "Ouvrir Mes espaces", kind: "NAVIGATION" },
};

export type HomeIntentChoice = HomeIntentDestination & { intent: HomeIntent };

export function homeIntentChoice(intent: HomeActionIntent): HomeIntentChoice {
  return { intent, ...HOME_INTENT_DESTINATIONS[intent] };
}

export function isSafeHomeDestination(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") && !/[\r\n]/.test(href);
}
