import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasUsefulGLinkMatchingCriteria,
  matchingProfileFromSource,
  parseGLinkMatchingAnalysis,
  serializeGLinkMatchingAnalysis,
} from "../lib/ai/relational-matching-source.ts";
import { deriveGLinkMatchingSummary, mergeGLinkRules, parseGLinkMatchingState } from "../lib/glink-matching.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("GLink matching builds a common profile without RelationCase", () => {
  const link = {
    sourceType: "GLINK" as const,
    sourceId: "link-1",
    ownerId: "owner-1",
    title: "Recherche appartement à Nice",
    description: "Budget maximum 1000 euros",
    fields: [
      { label: "Ville recherchée", type: "TEXT" },
      { label: "Budget maximum", type: "NUMBER", validationRules: { operator: "LTE", mode: "INDICATIVE", value: "1000" } },
    ],
  };
  assert.equal(hasUsefulGLinkMatchingCriteria(link), true);
  const profile = matchingProfileFromSource(link);
  assert.equal(profile.relationType, "logement");
  assert.equal(profile.location, "Nice");
});

test("stored analysis keeps stable GLINK source identity", () => {
  const stored = serializeGLinkMatchingAnalysis({
    sourceType: "GLINK", sourceId: "link-1", matchCount: 0, matches: [],
  });
  assert.equal(parseGLinkMatchingAnalysis(stored)?.sourceId, "link-1");
});

test("GLink matching is disabled by default and requires explicit opt-in", () => {
  assert.equal(parseGLinkMatchingState(null).enabled, false);
  const enabledRules = mergeGLinkRules({ simpleLink: true }, { matchingEnabled: true, matchingStatus: "TO_ANALYZE" });
  assert.deepEqual(parseGLinkMatchingState(enabledRules), { enabled: true, status: "TO_ANALYZE" });
});

test("GLink route and pilotage reuse existing engines with human actions only", () => {
  const route = source("app/api/links/[linkId]/matching/route.ts");
  const execution = source("lib/matching/matching-execution-service.ts");
  const engineAdapter = source("lib/matching/glink-matching-engine-adapter.ts");
  const pilotage = source("lib/governance-pilotage-repository.ts");
  const page = source("components/GLinkMatchingPanel.tsx");
  const creation = source("app/api/links/simple/route.ts");
  assert.match(engineAdapter, /rankMatches/);
  assert.match(engineAdapter, /semanticMatchV2/);
  assert.match(route, /MatchingExecutionService/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /transitionMatchingResult/);
  const decisionPatch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("async function readIdempotencyKey"));
  assert.doesNotMatch(decisionPatch, /aIEvent|glink_matching_interested|glink_matching_ignored/);
  assert.match(route, /glink_matching_analysis/);
  assert.match(pilotage, /GLINK:\$\{link\.id\}:MATCHING_TO_ANALYZE/);
  assert.match(pilotage, /MATCHES_TO_REVIEW/);
  assert.match(pilotage, /FOLLOW_UP_TO_DECIDE/);
  assert.match(page, /Aucun contact automatique/);
  assert.match(page, /Activer le matching/);
  assert.match(page, /window\.confirm/);
  assert.match(creation, /matchingEnabled: body\.matchingEnabled === true/);
  assert.doesNotMatch(`${route}\n${execution}`, /sendEmail|sendMail|notification|candidateAccessToken|RelationCase\.create/);
});

const date = new Date("2026-07-30T12:00:00.000Z");
const result = (status: "AVAILABLE" | "SELECTED" | "DISMISSED" | "LINKED") => ({ status });
const run = (status: "PREPARED" | "RUNNING" | "RESULTS_AVAILABLE" | "FAILED" | "CLOSED", results: Array<ReturnType<typeof result>> = []) => ({
  status, createdAt: date, completedAt: status === "RESULTS_AVAILABLE" ? date : null, results,
});

test("persistent matching summary distinguishes absent, unfinished and empty final runs", () => {
  assert.deepEqual(deriveGLinkMatchingSummary(null), {
    hasRun: false, runStatus: null, lastRunAt: null, totalResults: 0,
    availableCount: 0, selectedCount: 0, dismissedCount: 0, linkedCount: 0,
    hasResultsToReview: false, hasHumanFollowUp: false, hasNoResults: false,
  });
  assert.equal(deriveGLinkMatchingSummary(run("RUNNING")).hasNoResults, false);
  assert.equal(deriveGLinkMatchingSummary(run("RESULTS_AVAILABLE")).hasNoResults, true);
});

test("persistent matching summary classifies every result state without automatic follow-up", () => {
  const available = deriveGLinkMatchingSummary(run("RESULTS_AVAILABLE", [result("AVAILABLE")]));
  assert.equal(available.hasResultsToReview, true);
  const selected = deriveGLinkMatchingSummary(run("RESULTS_AVAILABLE", [result("SELECTED")]));
  assert.equal(selected.hasHumanFollowUp, true);
  const dismissed = deriveGLinkMatchingSummary(run("RESULTS_AVAILABLE", [result("DISMISSED")]));
  assert.equal(dismissed.hasResultsToReview, false);
  assert.equal(dismissed.hasHumanFollowUp, false);
  const mixed = deriveGLinkMatchingSummary(run("RESULTS_AVAILABLE", [result("AVAILABLE"), result("SELECTED"), result("DISMISSED"), result("LINKED")]));
  assert.deepEqual(
    [mixed.totalResults, mixed.availableCount, mixed.selectedCount, mixed.dismissedCount, mixed.linkedCount],
    [4, 1, 1, 1, 1],
  );
});

test("application matching reads are persistent and owner-scoped while analysis remains audit-only", () => {
  const matching = source("lib/glink-matching.ts");
  const repository = source("lib/matching/glink-matching-summary-repository.ts");
  const surfaces = [source("app/(connected)/dashboard/page.tsx"), source("lib/governance-pilotage-repository.ts")].join("\n");
  assert.match(repository, /where: \{ ownerId, gLinkId: \{ in: gLinkIds \} \}/);
  assert.match(repository, /distinct: \["gLinkId"\]/);
  assert.match(repository, /orderBy: \[\{ gLinkId: "asc" \}, \{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.doesNotMatch(`${matching}\n${surfaces}`, /glink_matching_interested|glink_matching_ignored/);
  assert.match(source("app/api/links/[linkId]/matching/route.ts"), /glink_matching_analysis/);
  assert.doesNotMatch(`${matching}\n${repository}`, /sendEmail|sendMail|notification|candidateAccessToken|relationCase\.create/);
});
