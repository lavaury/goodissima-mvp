export const opportunityNavigation = [
  { label: "Mes annonces", href: "/opportunities" },
  { label: "Mes parcours", href: "/templates" },
  { label: "Mes relations", href: "/relations" },
] as const;

export const opportunityVocabulary = {
  publish: "Publier l'annonce",
  createSecureLink: "Créer un lien sécurisé pour cette annonce",
  objectives: "Objectifs de la recherche",
  process: "Processus de suivi",
  requestedDocuments: "Documents demandés",
  plannedStages: "Étapes prévues",
  aiAssistance: "Assistance IA",
} as const;

export const standardViewHiddenTerms = [
  "Champs",
  "Règles",
  "Version active",
  "CIRO",
  "form schema",
] as const;

export type ProposalVersion<T> = { version: number; value: T };

export type ProposalChanges = {
  added: string[];
  removed: string[];
  modified: string[];
};

function stringSet(value: unknown) {
  if (!Array.isArray(value)) return new Set<string>();
  return new Set(value.map((item) => JSON.stringify(item)));
}

export function compareProposalVersions(previous: Record<string, unknown>, current: Record<string, unknown>): ProposalChanges {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    const before = previous[key];
    const after = current[key];
    if (Array.isArray(before) || Array.isArray(after)) {
      const beforeSet = stringSet(before);
      const afterSet = stringSet(after);
      if ([...afterSet].some((item) => !beforeSet.has(item))) added.push(key);
      if ([...beforeSet].some((item) => !afterSet.has(item))) removed.push(key);
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      modified.push(key);
    }
  }
  return { added, removed, modified };
}

export function publicAnnouncementHref(slug: string) {
  return `/l/${encodeURIComponent(slug)}`;
}

export function relationshipWorkspaceHref(status: string, caseId: string) {
  return status === "ACCEPTED" ? `/cases/${caseId}` : null;
}

export const domainGovernance = {
  automaticPublication: false,
  automaticContact: false,
  automaticWorkflowExecution: false,
  announcementUsesOneJourney: true,
  secureLinkDistributes: "announcement",
} as const;

export const aiInstructionsCreationCopy = {
  title: "Comportement attendu de l'assistant IA",
  helper: "Définissez ce que l'assistant peut vérifier, signaler ou proposer. Il ne prendra aucune décision à votre place.",
} as const;

export const publicAnnouncementSections = ["visual", "title", "location", "highlights", "description", "attachments", "verifiedLinks", "trust"] as const;

export const legacyDomainMapping = {
  RelationTemplate: "journey",
  FormTemplate: "journey-form",
  GLink: "announcement",
  RelationCase: "relationship",
} as const;
