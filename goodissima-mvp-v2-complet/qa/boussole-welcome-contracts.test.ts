import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boussoleRegistry } from "../lib/boussole/registry.ts";
import {
  WELCOME_ENTRY_KEYS,
  WELCOME_ENTRY_TARGET_IDS,
  WELCOME_JOURNEY_IDS,
  WELCOME_JOURNEY_VERSIONS,
  WELCOME_PAGE_ID,
  WELCOME_STEP_IDS,
  WELCOME_TARGET_IDS,
  type WelcomeIntent,
} from "../lib/boussole/welcome-contracts.ts";
import { welcomeEntries, welcomeGeneralContent } from "../lib/boussole/welcome-content.ts";
import { welcomeManifest } from "../lib/boussole/welcome-manifest.ts";
import { orientWelcomeIntent } from "../lib/boussole/welcome-orientation.ts";

test("defines exactly four ordered and unique primary entries", () => {
  assert.equal(welcomeEntries.length, 4);
  assert.deepEqual(welcomeEntries.map((entry) => entry.key), WELCOME_ENTRY_KEYS);
  assert.equal(new Set(welcomeEntries.map((entry) => entry.key)).size, 4);
  assert.equal(new Set(welcomeEntries.map((entry) => entry.stableId)).size, 4);
  assert.deepEqual(welcomeEntries.map((entry) => entry.sortOrder), [1, 2, 3, 4]);
  assert.ok(WELCOME_ENTRY_TARGET_IDS.every((targetId) => WELCOME_TARGET_IDS.includes(targetId)));
});

test("maps every entry key to its exact stable target and route", () => {
  assert.deepEqual(welcomeEntries.map(({ key, stableId, route }) => ({ key, stableId, route })), [
    { key: "SIMPLE_LINK", stableId: "welcome-entry-simple-link", route: "/links/simple" },
    { key: "OPPORTUNITY", stableId: "welcome-entry-opportunity", route: "/opportunities/new" },
    { key: "GOVERNED_JOURNEY", stableId: "welcome-entry-governed-journey", route: "/gouvernance/nouveau" },
    { key: "EXISTING_ACTIVITY", stableId: "welcome-entry-existing-activity", route: "/dashboard" },
  ]);
  assert.ok(welcomeEntries.every((entry) => entry.route !== ("/gouvernance/pilotage" as string)));
});

test("provides complete, progressive and human-controlled entry content", () => {
  for (const entry of welcomeEntries) {
    assert.ok(entry.title.trim() && entry.description.trim() && entry.usageExample.trim());
    assert.match(entry.humanControlNotice, /ne |aucun|aucune|mais/i);
  }
  assert.match(welcomeEntries[1].explanationOfGoodissimaTerm ?? "", /opportunité/i);
  assert.match(welcomeEntries[2].explanationOfGoodissimaTerm ?? "", /parcours gouverné/i);
  assert.equal(welcomeEntries[1].targetJourneyId, null);
  assert.equal(welcomeEntries[1].contextualGuidanceStatus, "NEEDS_DEDICATED_JOURNEY");
});

test("orients four goals and leaves UNSURE unselected", () => {
  const cases: Array<[WelcomeIntent, string | null]> = [
    ["RECEIVE_RESPONSES", "SIMPLE_LINK"],
    ["PUBLISH_NEED_OR_PROPOSAL", "OPPORTUNITY"],
    ["COORDINATE_PEOPLE_AND_DECISIONS", "GOVERNED_JOURNEY"],
    ["REVIEW_EXISTING_ACTIVITY", "EXISTING_ACTIVITY"],
    ["UNSURE", null],
  ];
  for (const [intent, expected] of cases) {
    const result = orientWelcomeIntent(intent);
    assert.equal(result.recommendedEntry?.key ?? null, expected);
    assert.ok(result.understoodGoal && result.rationale && result.humanControlNotice && result.nextStep);
  }
  assert.match(orientWelcomeIntent("UNSURE").nextStep, /Découvrir|quatre choix/i);
});

test("keeps orientation pure and free of navigation or external calls", () => {
  const source = readFileSync(new URL("../lib/boussole/welcome-orientation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|router\.|window\.|location\.|Mistral|create[A-Z]|navigate/i);
});

test("declares unique stable identifiers and initial versions", () => {
  const stepIds = Object.values(WELCOME_STEP_IDS).flat();
  const allIds = [WELCOME_PAGE_ID, ...WELCOME_JOURNEY_IDS, ...stepIds, ...WELCOME_TARGET_IDS];
  assert.equal(new Set(stepIds).size, stepIds.length);
  assert.equal(new Set(WELCOME_TARGET_IDS).size, WELCOME_TARGET_IDS.length);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(welcomeManifest.manifestVersion, 1);
  assert.deepEqual(Object.values(WELCOME_JOURNEY_VERSIONS), [1, 1, 1]);
  assert.deepEqual(welcomeManifest.applicableStates, ["EMPTY"]);
  assert.ok(welcomeManifest.journeys.every((journey) => journey.version === 1));
  for (const journey of welcomeManifest.journeys) {
    assert.strictEqual(journey.stepIds, WELCOME_STEP_IDS[journey.id]);
  }
  assert.strictEqual(welcomeManifest.targetIds, WELCOME_TARGET_IDS);
});

test("does not register the future welcome surface prematurely", () => {
  assert.ok(boussoleRegistry.every((entry) => entry.manifest.pageId !== WELCOME_PAGE_ID));
});

test("contains no duration promise or automatic action claim", () => {
  const text = JSON.stringify({ welcomeGeneralContent, welcomeEntries });
  const positiveAutomationPatterns = [
    /Goodissima(?![^.!?]*(?:\bne\b|n[’']))[^.!?]*\b(?:crée|publie|contacte|invite|décide)\b[^.!?]*\bautomatiquement\b/i,
    /(?<!aucune )\b(?:création|publication|contact|invitation|décision)\s+automatique\b/i,
  ];
  const hasPositiveAutomationClaim = (value: string) => positiveAutomationPatterns.some((pattern) => pattern.test(value));

  assert.doesNotMatch(text, /moins de deux minutes/i);
  assert.match(welcomeGeneralContent.shortDiscovery, /quelques étapes/i);
  assert.equal(hasPositiveAutomationClaim(text), false);
  for (const claim of [
    "Goodissima crée un contact automatiquement.",
    "Goodissima publie votre proposition automatiquement.",
    "Goodissima contacte les participants automatiquement.",
    "Goodissima invite les personnes automatiquement.",
    "Goodissima décide de la suite automatiquement.",
    "Une création automatique.",
    "Une publication automatique.",
    "Un contact automatique.",
    "Une invitation automatique.",
    "Une décision automatique.",
  ]) assert.equal(hasPositiveAutomationClaim(claim), true, claim);
  for (const safeguard of [
    "Goodissima ne crée aucun contact automatiquement.",
    "Goodissima ne publie rien automatiquement.",
    "Aucune création automatique.",
    "Aucune publication automatique.",
  ]) assert.equal(hasPositiveAutomationClaim(safeguard), false, safeguard);
  for (const notice of welcomeGeneralContent.humanControl) assert.match(notice, /Aucun|Aucune/);
});
