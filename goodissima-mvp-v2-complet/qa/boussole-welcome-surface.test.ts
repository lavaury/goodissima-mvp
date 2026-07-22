import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { WELCOME_ENTRY_TARGET_IDS, WELCOME_INTENTS, WELCOME_MODES, WELCOME_STEP_IDS } from "../lib/boussole/welcome-contracts.ts";
import { welcomeGeneralContent } from "../lib/boussole/welcome-content.ts";

const page = readFileSync(new URL("../app/boussole/decouverte/page.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/BoussoleWelcomeDiscovery.tsx", import.meta.url), "utf8");

test("creates an authenticated discovery route with one h1", () => {
  assert.match(page, /requireCurrentUser\(\)/);
  assert.match(page, /BoussoleWelcomeDiscovery/);
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((component.match(/<h1\b/g) ?? []).length, 0);
});

test("consumes shared content, entries and deterministic orientation", () => {
  assert.match(page + component, /welcomeGeneralContent/);
  assert.match(component, /welcomeEntries\.map/);
  assert.match(component, /orientWelcomeIntent\(intent\)/);
  assert.doesNotMatch(component, /const\s+welcomeEntries|route:\s*["']\/(?:links|opportunities|gouvernance|dashboard)/);
});

test("renders exactly the three shared modes as accessible pressed buttons", () => {
  assert.match(component, /WELCOME_MODES\.map/);
  assert.match(component, /aria-pressed=\{mode === candidate\}/);
  assert.deepEqual(WELCOME_MODES.map((mode) => welcomeGeneralContent.modes[mode]), [
    "Je découvre Goodissima", "Je sais déjà ce que je veux faire", "J’ai besoin d’aide pour choisir",
  ]);
});

test("uses shared stable entry targets and requires selection before navigation", () => {
  assert.match(component, /data-boussole-id=\{entry\.stableId\}/);
  assert.match(component, /setConfirmationEntryKey/);
  assert.match(component, /<Link href=\{entry\.route\}/);
  assert.match(component, /Ouvrir cette page/);
  for (const stableId of WELCOME_ENTRY_TARGET_IDS) assert.doesNotMatch(component, new RegExp(`data-boussole-id=["']${stableId}`));
});

test("implements the six manual DISCOVER steps without persistence", () => {
  assert.match(component, /WELCOME_STEP_IDS\["welcome-discover"\]/);
  for (const stepId of WELCOME_STEP_IDS["welcome-discover"]) assert.ok(component.includes(`stepId === "${stepId}"`));
  assert.match(component, /Précédent/);
  assert.match(component, /Suivant/);
  assert.match(component, /Étape \{stepIndex \+ 1\} sur/);
});

test("uses all five closed HELP intentions and keeps UNSURE without a route link", () => {
  assert.match(component, /WELCOME_INTENTS\.map/);
  assert.match(component, /orientation\.recommendedEntry \?/);
  assert.match(component, /Découvrir Goodissima/);
  assert.match(component, /Voir les quatre possibilités/);
  for (const intent of WELCOME_INTENTS) assert.ok(component.includes(`${intent}:`));
  assert.doesNotMatch(component, /getWelcomeEntry\("SIMPLE_LINK"\)|UNSURE[^\n]+SIMPLE_LINK/);
});

test("contains no automatic navigation, external call, AI, storage or business repository", () => {
  const source = page + component;
  assert.doesNotMatch(source, /router\.(?:push|replace)|useRouter|setTimeout|fetch\s*\(|Mistral|\/api\/|Repository|repository/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie|cookies\s*\(/);
  assert.doesNotMatch(source, /matching|faux dossier|faux contact|moins de deux minutes/i);
});

test("exposes human-control notices and static illustration labels", () => {
  assert.match(component, /welcomeGeneralContent\.humanControl\.map/);
  assert.match(component, /Illustration — aucune donnée enregistrée/g);
  assert.match(component, /welcome-situation-illustration/);
  assert.match(component, /welcome-principle-illustration/);
  assert.match(component, /welcome-recommendation/);
  assert.match(component, /welcome-primary-navigation/);
});

test("uses explicit heading levels for cards, notices and confirmations", () => {
  assert.match(component, /<EntryChoices headingLevel=\{3\} selectedKey=\{selectedEntryKey\}/);
  assert.match(component, /<EntryCards headingLevel=\{4\} selectable=\{false\}/);
  assert.match(component, /<EntryChoices headingLevel=\{4\} selectedKey=\{selectedEntry\?\.key/);
  assert.match(component, /<HumanControlNotice headingLevel=\{2\}/);
  assert.match(component, /<HumanControlNotice headingLevel=\{3\} heading=/);
  assert.match(component, /<EntryConfirmation headingLevel=\{4\} entry=\{confirmationEntry\}/);
  assert.match(component, /<EntryConfirmation headingLevel=\{3\} entry=\{confirmationEntry\}/);
  assert.match(component, /mode === "HELP" && confirmationEntry \? <EntryConfirmation headingLevel=\{2\}/);
  assert.match(component, /headingLevel: 3 \| 4/);
  assert.match(component, /headingLevel: 2 \| 3; heading\?: string/);
  assert.match(component, /headingLevel: 2 \| 3 \| 4/);

  const directSection = component.slice(component.indexOf('{mode === "DIRECT"'), component.indexOf('{mode === "HELP"'));
  assert.doesNotMatch(directSection, /<h4\b|headingLevel=\{4\}/);
});
