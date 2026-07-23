import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasUsefulGLinkMatchingCriteria,
  matchingProfileFromSource,
  parseGLinkMatchingAnalysis,
  serializeGLinkMatchingAnalysis,
} from "../lib/ai/relational-matching-source.ts";
import { mergeGLinkRules, parseGLinkMatchingState } from "../lib/glink-matching.ts";

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
  assert.match(route, /matchingResult\.findFirst/);
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
