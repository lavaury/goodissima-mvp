import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { WELCOME_ENTRY_TARGET_IDS, WELCOME_INTENTS, WELCOME_MODES, WELCOME_STEP_IDS } from "../lib/boussole/welcome-contracts.ts";
import { welcomeGeneralContent } from "../lib/boussole/welcome-content.ts";

const page = readFileSync(new URL("../app/boussole/decouverte/page.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../components/BoussoleWelcomeDiscovery.tsx", import.meta.url), "utf8");
const scenes = readFileSync(new URL("../components/boussole/welcome/WelcomeScenes.tsx", import.meta.url), "utf8");

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
  assert.equal(WELCOME_STEP_IDS["welcome-discover"].length, 6);
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
  assert.match(scenes, /Illustration pédagogique — aucune donnée enregistrée/);
  assert.match(scenes, /welcome-situation-illustration/);
  assert.match(scenes, /welcome-principle-illustration/);
  assert.match(component, /welcome-recommendation/);
  assert.match(component, /welcome-primary-navigation/);
});

test("uses explicit heading levels for cards, notices and confirmations", () => {
  assert.match(component, /<EntryChoices headingLevel=\{3\} selectedKey=\{selectedEntryKey\}/);
  assert.match(component, /<EntryChoices headingLevel=\{4\} selectedKey=\{selectedEntry\?\.key[^>]*showScene=\{false\}/);
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

test("makes step four illustrative and explicitly leads to selection", () => {
  const stepFourStart = component.indexOf('{stepId === "welcome-entry-points" ?');
  const stepFour = component.slice(stepFourStart, component.indexOf('{stepId === "welcome-first-action" ?', stepFourStart));
  assert.match(stepFour, /<EntryOverview sceneProps=\{sceneProps\}/);
  assert.doesNotMatch(stepFour, /EntryCards|EntryChoices|onEntrySelect|aria-pressed/);

  const overviewStart = component.indexOf("function EntryOverview");
  const overview = component.slice(overviewStart, component.indexOf("function EntryChoices", overviewStart));
  assert.match(overview, /<WelcomeEntryScene selectedKey=\{null\} \{\.\.\.sceneProps\}/);
  assert.doesNotMatch(overview, /<EntryCards|selectable/);
  assert.match(overview, /À l’étape suivante, vous choisirez la possibilité qui vous correspond\./);
  assert.match(component, /stepId === "welcome-entry-points"[^]*\? "Continuer pour choisir"/);
});

test("makes step five the only selectable DISCOVER step", () => {
  const stepFive = component.slice(component.indexOf('stepId === "welcome-first-action" ?'), component.indexOf('stepId === "welcome-handoff" ?'));
  assert.match(stepFive, /Choisissez une première action/);
  assert.match(stepFive, /Sélectionnez une possibilité pour continuer vers la vérification\./);
  assert.match(stepFive, /<EntryChoices headingLevel=\{4\}[^>]*showScene=\{false\}/);
  assert.match(stepFive, /<p role="status" aria-live="polite" aria-atomic="true"[^>]*>\{selectedEntry \? `Vous avez choisi : \$\{selectedEntry\.title\}\. Vous pouvez maintenant vérifier ce choix\.` : ""\}<\/p>/);
  assert.doesNotMatch(stepFive, /selectedEntry \? <p role="status"/);
  assert.match(stepFive, /className=\{`mt-4 min-h-6[^`]*\$\{selectedEntry \? "rounded-lg bg-cyan-50 p-3 text-cyan-950" : "text-slate-700"\}`\}/);
  assert.doesNotMatch(stepFive, /bg-amber|text-amber/);
  assert.doesNotMatch(stepFive, /cechoix/);

  const chooseEntry = component.slice(component.indexOf("function chooseEntry"), component.indexOf("function chooseIntent"));
  assert.match(chooseEntry, /setSelectedEntryKey\(entry\.key\)/);
  assert.doesNotMatch(chooseEntry, /setDiscoverStepIndex|onStepChange|focus\s*\(|autoFocus/);
  assert.doesNotMatch(component, /autoFocus|\.focus\s*\(/);

  const cardsStart = component.indexOf("function EntryCards");
  const cards = component.slice(cardsStart, component.indexOf("function HelpMode", cardsStart));
  assert.match(cards, /welcomeEntries\.map/);
  assert.match(cards, /aria-pressed=\{selectedKey === entry\.key\}/);
  assert.match(cards, /w-full[^]*sm:w-auto/);
  assert.match(cards, /Possibilité sélectionnée : \$\{entry\.title\}/);
});

test("explains and gates the human-controlled transition to step six", () => {
  assert.match(component, /const canContinue = stepId !== "welcome-first-action" \|\| Boolean\(selectedEntry\)/);
  assert.match(component, /stepId === "welcome-first-action" && !selectedEntry \? <p[^>]*>Choisissez une possibilité pour accéder à l’étape 6\.<\/p>/);
  assert.match(component, /disabled=\{stepIndex === discoverStepIds\.length - 1 \|\| !canContinue\}/);
  assert.match(component, /onClick=\{\(\) => onStepChange\(Math\.min\(discoverStepIds\.length - 1, stepIndex \+ 1\)\)\}/);
  assert.match(component, /stepId === "welcome-first-action" && selectedEntry[^]*\? "Suivant : vérifier ce choix"/);
  assert.match(component, /stepId === "welcome-handoff" \? selectedEntry \?/);
  assert.match(component, /Étape \{stepIndex \+ 1\} sur \{discoverStepIds\.length\}/);
});

test("keeps the Dashboard escape explicit and secondary", () => {
  assert.equal(welcomeGeneralContent.exitLabels.dashboard, "Passer la découverte et ouvrir le Dashboard");
  assert.match(page, /<Link href="\/dashboard"[^>]*border[^>]*bg-white[^>]*>\s*\{welcomeGeneralContent\.exitLabels\.dashboard\}\s*<\/Link>/);
  assert.equal((page.match(/Passer la découverte et ouvrir le Dashboard/g) ?? []).length, 0);
  assert.doesNotMatch(page, /router\.(?:push|replace)|useRouter/);
});

test("places the dominant mode surface before optional media controls", () => {
  const renderedMedia = component.lastIndexOf("<WelcomeMediaControls");
  assert.ok(component.indexOf('{mode === "DISCOVER"') < renderedMedia);
  assert.ok(component.indexOf('{mode === "DIRECT"') < renderedMedia);
  assert.ok(component.indexOf('{mode === "HELP"') < renderedMedia);
  assert.match(component, /<WelcomePrincipleScene key=\{sceneProps\.runId\}/);
});

test("keeps a compact global human reminder and a detailed dedicated step", () => {
  assert.match(component, /Vous gardez la main/);
  assert.match(component, /Rien n’est publié, envoyé, créé ou décidé sans votre action\./);
  assert.match(component, /<details[^>]*>[^]*Voir les garanties de contrôle humain[^]*welcomeGeneralContent\.humanControl\.map/);
  const dedicatedStart = component.indexOf('if (headingLevel === 3)');
  const dedicatedNotice = component.slice(dedicatedStart, component.indexOf("\n  }\n  return", dedicatedStart));
  assert.match(dedicatedNotice, /welcomeGeneralContent\.humanControl\.map/);
  assert.doesNotMatch(dedicatedNotice, /<details/);
});

test("keeps one explicit business navigation after confirmation", () => {
  assert.equal((component.match(/<Link\b/g) ?? []).length, 1);
  assert.match(component, /<Link href=\{entry\.route\} onClick=\{onNavigate\}/);
  assert.doesNotMatch(component, /router\.(?:push|replace)|useRouter|fetch\s*\(|\/api\/|Mistral|Repository|repository|localStorage|sessionStorage/);
});
