import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deriveGLinkMatchingDisplayState,
  wasGLinkMatchingEnabledAtCreation,
} from "../lib/glink-matching.ts";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("business collection and pilotage retain GLink matching state derivation", () => {
  const dashboard = source("app/(connected)/opportunities/page.tsx");
  const pilotage = source("lib/governance-pilotage-repository.ts");
  const card = source("components/LinkCard.tsx");
  assert.match(dashboard, /deriveGLinkMatchingDisplayState/);
  assert.match(pilotage, /deriveGLinkMatchingDisplayState/);
  assert.match(card, /Matching relationnel/);
  assert.match(card, /À analyser/);
  assert.match(card, /Correspondances à examiner/);
  assert.match(card, /Suite à décider/);
  assert.match(card, /Aucune correspondance exploitable/);
  assert.match(card, /\/links\/\$\{item\.id\}#matching/);
});

test("GLink creation is derived once into the dashboard chronology without requiring a case", () => {
  const repository = source("lib/dashboard-activity-repository.ts");
  assert.match(repository, /label: "Lien créé"/);
  assert.match(repository, /href: `\/links\//);
  assert.doesNotMatch(repository, /candidateAccessToken|\/secure\//);
});

test("creation matching metadata remains distinct from later activation", () => {
  assert.equal(wasGLinkMatchingEnabledAtCreation({ matchingEnabled: true }), false);
  assert.equal(wasGLinkMatchingEnabledAtCreation({ matchingEnabledAtCreation: true }), true);
  assert.deepEqual(
    deriveGLinkMatchingDisplayState({ rules: { matchingEnabled: true }, summary: undefined }),
    { status: "TO_ANALYZE", count: 0 },
  );
});
