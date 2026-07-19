import type { BoussoleProgress, BoussoleProgressStore } from "./contracts.ts";

export const emptyBoussoleProgressStore = (): BoussoleProgressStore => ({ progressions: {}, notifiedVersions: {} });

export function parseBoussoleProgressStore(raw: string | null): BoussoleProgressStore {
  if (!raw) return emptyBoussoleProgressStore();
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return emptyBoussoleProgressStore();
    const candidate = value as Partial<BoussoleProgressStore>;
    return {
      progressions: candidate.progressions && typeof candidate.progressions === "object" ? candidate.progressions : {},
      notifiedVersions: candidate.notifiedVersions && typeof candidate.notifiedVersions === "object" ? candidate.notifiedVersions : {},
      activeJourneyId: typeof candidate.activeJourneyId === "string" ? candidate.activeJourneyId : undefined,
    };
  } catch {
    return emptyBoussoleProgressStore();
  }
}

export function resolveBoussoleProgress({
  raw,
  pageId,
  journeyId,
  journeyVersion,
  validStepIds,
  legacyStepIndex,
  resume = true,
}: {
  raw: string | null;
  pageId: string;
  journeyId: string;
  journeyVersion: number;
  validStepIds: string[];
  legacyStepIndex?: number;
  resume?: boolean;
}) {
  const store = parseBoussoleProgressStore(raw);
  const firstStepId = validStepIds[0];
  if (!resume) return { store, stepId: firstStepId, guideUpdated: false, missingStepId: undefined, shouldPersist: false };
  const saved = store.progressions[journeyId];
  let stepId: string | undefined;
  let guideUpdated = false;
  let missingStepId: string | undefined;

  if (saved?.journeyVersion === journeyVersion && validStepIds.includes(saved.stepId)) stepId = saved.stepId;
  else if (saved?.journeyVersion === journeyVersion) missingStepId = saved.stepId;
  else if (saved) {
    guideUpdated = store.notifiedVersions[journeyId] !== journeyVersion;
    store.notifiedVersions[journeyId] = journeyVersion;
  } else if (Number.isInteger(legacyStepIndex) && legacyStepIndex! >= 0) {
    stepId = validStepIds[legacyStepIndex!];
  }

  stepId ??= firstStepId;
  if (stepId) store.progressions[journeyId] = createBoussoleProgress({ pageId, journeyId, journeyVersion, stepId });
  return { store, stepId, guideUpdated, missingStepId, shouldPersist: Boolean(stepId) };
}

export function createBoussoleProgress(value: Omit<BoussoleProgress, "updatedAt">): BoussoleProgress {
  return { ...value, updatedAt: new Date().toISOString() };
}
