export type ProposalChangeSet = {
  added: string[];
  modified: string[];
  removed: string[];
};

export type ProposalVersion<TDraft, TValidation, TProvenance = unknown> = {
  generationId: string;
  version: number;
  draft: TDraft;
  validation: TValidation;
  provenance?: TProvenance;
  feedback?: string;
  changes: ProposalChangeSet;
};

const sectionLabels: Record<string, string> = {
  name: "Titre",
  description: "Description",
  actors: "Acteurs",
  stages: "Étapes",
  documents: "Documents",
  relationalRequests: "Demandes relationnelles",
  kpis: "Indicateurs",
  fields: "Champs",
};

function itemIdentity(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return JSON.stringify(value);
  const item = value as Record<string, unknown>;
  return String(item.name ?? item.title ?? item.label ?? item.key ?? JSON.stringify(item));
}

function itemMap(value: unknown) {
  return new Map((Array.isArray(value) ? value : []).map((item) => [itemIdentity(item), item]));
}

export function describeProposalChanges(previous: Record<string, unknown>, current: Record<string, unknown>): ProposalChangeSet {
  const changes: ProposalChangeSet = { added: [], modified: [], removed: [] };
  for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
    const label = sectionLabels[key] ?? key;
    const before = previous[key];
    const after = current[key];
    if (Array.isArray(before) || Array.isArray(after)) {
      const beforeItems = itemMap(before);
      const afterItems = itemMap(after);
      for (const [name, value] of afterItems) {
        if (!beforeItems.has(name)) changes.added.push(`${label} : ${name}`);
        else if (JSON.stringify(beforeItems.get(name)) !== JSON.stringify(value)) changes.modified.push(`${label} : ${name}`);
      }
      for (const name of beforeItems.keys()) {
        if (!afterItems.has(name)) changes.removed.push(`${label} : ${name}`);
      }
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.modified.push(label);
    }
  }
  return changes;
}

export function appendProposalVersion<TDraft, TValidation, TProvenance>(
  history: Array<ProposalVersion<TDraft, TValidation, TProvenance>>,
  version: Omit<ProposalVersion<TDraft, TValidation, TProvenance>, "version">,
) {
  return [...history, { ...version, version: history.length + 1 }];
}

export function createProposalRevision<TDraft, TValidation, TProvenance>(
  history: Array<ProposalVersion<TDraft, TValidation, TProvenance>>,
  revision: Omit<ProposalVersion<TDraft, TValidation, TProvenance>, "version" | "changes"> & { sourceGenerationId: string },
) {
  const previous = history.find((item) => item.generationId === revision.sourceGenerationId)?.draft ?? history.at(-1)?.draft;
  const changes = previous && typeof previous === "object" && typeof revision.draft === "object"
    ? describeProposalChanges(previous as Record<string, unknown>, revision.draft as Record<string, unknown>)
    : { added: [], modified: [], removed: [] };
  const { sourceGenerationId: _sourceGenerationId, ...version } = revision;
  return appendProposalVersion(history, { ...version, changes });
}

export function previousProposalVersion<TDraft, TValidation, TProvenance>(
  history: Array<ProposalVersion<TDraft, TValidation, TProvenance>>,
) {
  return history.length > 1 ? history[history.length - 2] : null;
}

export function canValidateProposalVersion(
  history: Array<{ generationId: string }>,
  generationId: string,
  humanValidated: boolean,
) {
  return humanValidated && history.some((version) => version.generationId === generationId);
}
