import type { BoussoleSequence } from "../boussole-dashboard.ts";
import { governanceSequences } from "../boussole-governance.ts";
import { governedJourneySequences } from "../boussole-governed-journey.ts";
import { newGovernedJourneySequences } from "../boussole-new-governed-journey.ts";
import { boussoleGlossary } from "./glossary.ts";
import type {
  BoussoleJourneyDefinition,
  BoussolePageManifest,
  BoussolePageState,
} from "./contracts.ts";

export type BoussoleRegistryEntry = {
  manifest: BoussolePageManifest;
  journeys: BoussoleJourneyDefinition[];
};

const commonStates: BoussolePageState[] = ["EMPTY", "POPULATED", "FOCUSED"];
const journeyVersions: Record<string, number> = {
  ...Object.fromEntries(governanceSequences.map((journey) => [journey.id, 1])),
  ...Object.fromEntries(newGovernedJourneySequences.map((journey) => [journey.id, 1])),
  ...Object.fromEntries(governedJourneySequences.map((journey) => [journey.id, 1])),
};

export function getBoussoleJourneyVersion(journeyId: string) {
  return journeyVersions[journeyId] ?? 1;
}

function registerPage(
  pageId: string,
  routes: string[],
  sourceJourneys: BoussoleSequence[],
): BoussoleRegistryEntry {
  const version = 1;
  const journeys = sourceJourneys.map((journey) => ({
    id: journey.id,
    pageId,
    version: getBoussoleJourneyVersion(journey.id),
    title: journey.title,
    applicableStates: journey.applicableStates ?? [...commonStates],
    steps: journey.steps,
  }));

  return {
    manifest: {
      pageId,
      version,
      routes,
      supportedStates: [...commonStates],
      targets: [...new Set(sourceJourneys.flatMap((journey) => journey.steps.flatMap((step) =>
        [step.targetId, step.fallbackTargetId].filter((target): target is string => Boolean(target)),
      )))],
      journeyIds: sourceJourneys.map((journey) => journey.id),
    },
    journeys,
  };
}

export const boussoleRegistry: BoussoleRegistryEntry[] = [
  registerPage("governance", ["/gouvernance"], governanceSequences),
  registerPage("new-governed-journey", ["/gouvernance/nouveau"], newGovernedJourneySequences),
  registerPage("governed-journey-cockpit", ["/gouvernance/parcours/:id/pilotage"], governedJourneySequences),
];

export type BoussoleIntegrityIssue = {
  pageId: string;
  journeyId?: string;
  stepId?: string;
  reference: string;
  message: string;
};

function issue(
  pageId: string,
  reference: string,
  message: string,
  journeyId?: string,
  stepId?: string,
): BoussoleIntegrityIssue {
  return { pageId, journeyId, stepId, reference, message };
}

export function formatBoussoleIntegrityIssue(value: BoussoleIntegrityIssue) {
  return `page=${value.pageId} parcours=${value.journeyId ?? "-"} étape=${value.stepId ?? "-"} référence=${value.reference} : ${value.message}`;
}

export function validateBoussoleRegistry(
  registry: readonly BoussoleRegistryEntry[] = boussoleRegistry,
): BoussoleIntegrityIssue[] {
  const issues: BoussoleIntegrityIssue[] = [];
  const pageIds = new Set<string>();
  const journeyIds = new Set<string>();
  const glossaryIds = new Set(boussoleGlossary.map((term) => term.id));

  for (const { manifest, journeys } of registry) {
    const { pageId } = manifest;
    if (pageIds.has(pageId)) issues.push(issue(pageId, pageId, "pageId dupliqué"));
    pageIds.add(pageId);
    if (!Number.isInteger(manifest.version) || manifest.version <= 0) issues.push(issue(pageId, String(manifest.version), "version non positive"));
    if (manifest.routes.length === 0) issues.push(issue(pageId, "routes", "famille de routes absente"));

    const targets = new Set(manifest.targets);
    const declaredJourneyIds = new Set(manifest.journeyIds);
    const actualJourneyIds = new Set(journeys.map((journey) => journey.id));

    for (const declaredId of declaredJourneyIds) {
      if (!actualJourneyIds.has(declaredId)) issues.push(issue(pageId, declaredId, "journeyId déclaré mais inexistant", declaredId));
    }
    for (const journey of journeys) {
      if (!declaredJourneyIds.has(journey.id)) issues.push(issue(pageId, journey.id, "parcours orphelin non déclaré", journey.id));
      if (journeyIds.has(journey.id)) issues.push(issue(pageId, journey.id, "journeyId dupliqué", journey.id));
      journeyIds.add(journey.id);
      if (journey.pageId !== pageId) issues.push(issue(pageId, journey.pageId, "pageId du parcours incohérent", journey.id));
      if (!Number.isInteger(journey.version) || journey.version <= 0) issues.push(issue(pageId, String(journey.version), "version du parcours non positive", journey.id));

      const stepIds = new Set<string>();
      const journeyTargets = new Set(journey.steps.flatMap((step) => step.targetId ? [step.targetId] : []));
      for (const [index, step] of journey.steps.entries()) {
        const stepId = step.id ?? `index-${index}`;
        if (!step.id) issues.push(issue(pageId, "id", "stepId absent", journey.id, stepId));
        else if (stepIds.has(step.id)) issues.push(issue(pageId, step.id, "stepId dupliqué dans le parcours", journey.id, step.id));
        if (step.id) stepIds.add(step.id);

        if (step.targetId && !targets.has(step.targetId)) issues.push(issue(pageId, step.targetId, "targetId inconnu du manifeste", journey.id, stepId));
        if (step.fallbackTargetId) {
          if (!targets.has(step.fallbackTargetId)) issues.push(issue(pageId, step.fallbackTargetId, "fallbackTargetId inconnu du manifeste", journey.id, stepId));
          if (!journeyTargets.has(step.fallbackTargetId)) issues.push(issue(pageId, step.fallbackTargetId, "fallback hors du micro-parcours", journey.id, stepId));
        }
        for (const glossaryTermId of step.glossaryTermIds ?? []) {
          if (!glossaryIds.has(glossaryTermId)) issues.push(issue(pageId, glossaryTermId, "glossaryTermId inconnu", journey.id, stepId));
        }
      }
    }

    for (const target of targets) {
      const used = journeys.some((journey) => journey.steps.some((step) => step.targetId === target || step.fallbackTargetId === target));
      if (!used) issues.push(issue(pageId, target, "cible orpheline du manifeste"));
    }
  }

  return issues;
}
