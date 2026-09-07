import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { governanceSequences, governanceSteps } from "../lib/boussole-governance.ts";
import { getCompassContext } from "../lib/boussole-context.ts";
import { getGlossaryTerm, searchGlossary, validateGlossaryReferences } from "../lib/boussole/glossary.ts";
import { governedJourneySequences } from "../lib/boussole-governed-journey.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("journey pilotage glossary targets the real focused cockpit, never a Workspace", () => {
  const term = getGlossaryTerm("pilotage-de-parcours")!;
  assert.ok(term.targets.every(target => target.dataBoussoleId !== "open-workspace"));
  assert.deepEqual(term.targets, [{ dataBoussoleId: "governed-journey-overview", routes: ["/gouvernance/parcours/:id/pilotage"] }]);
  const discovery = governedJourneySequences.find(journey => journey.id === "discover-governed-journey")!;
  assert.deepEqual(discovery.applicableStates, ["FOCUSED"]);
  assert.ok(discovery.steps.some(step => step.targetId === term.targets[0].dataBoussoleId));
  const cockpit = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  assert.ok(cockpit.includes('data-boussole-id="governed-journey-overview"'));
  assert.ok(cockpit.indexOf("if (!formTemplate) notFound()") < cockpit.indexOf('data-boussole-id="governed-journey-overview"'));
  const boussole = read("components/ContextualBoussole.tsx");
  const show = boussole.slice(boussole.indexOf("function showGlossaryTarget"), boussole.indexOf("async function ask"));
  assert.match(show, /if \(!target\) return/);
  assert.doesNotMatch(show, /\.click\(|router\.|fetch\(/);
});

test("uses four Spaces micro-journeys backed by the main page", () => {
  assert.equal(governanceSequences.length, 4);
  assert.equal(governanceSteps.length, 27);
  assert.equal(getCompassContext("/gouvernance")?.steps, governanceSteps);
  assert.equal(getCompassContext("/gouvernance")?.pageName, "Comprendre Mes espaces");
  for (const step of governanceSteps) {
    assert.ok(step.targetId);
    assert.ok(step.detailedBody);
    assert.ok(step.animation?.narration);
    assert.ok(step.animation?.subtitles);
    assert.equal(step.animation?.tryNow, true);
  }
});

test("resolves every retained target on the real Governance page", () => {
  const page = `${read("app/(connected)/gouvernance/page.tsx")}\n${["components/WorkspaceRow.tsx", "components/PlatformNavigation.tsx", "components/SpacesTreeView.tsx", "components/SpacesCreateActions.tsx", "components/SpacesExistingAttachments.tsx"].map(read).join("\n")}`;
  for (const target of new Set(governanceSteps.map((step) => step.targetId))) assert.ok(page.includes(target!), `missing Governance target ${target}`);
  assert.match(page, /firstWorkspaceId/);
  assert.match(page, /workspace.id === firstWorkspaceId/);
  assert.doesNotMatch(page, /demo.*governance-first/i);
});

test("handles empty and populated Governance states without fictional content", () => {
  const targets = governanceSteps.map((step) => step.targetId);
  assert.ok(targets.includes("governance-empty-state"));
  assert.ok(targets.includes("governance-first-workspace"));
  assert.ok(targets.includes("governance-first-portfolio"));
  assert.ok(targets.includes("open-workspace"));
});

test("does not invent unavailable review, invitation or status summaries", () => {
  const targets = governanceSteps.map((step) => step.targetId);
  for (const unavailable of ["governance-pending-reviews-count", "governance-prepared-invitations-count", "governance-prepared-review", "governance-prepared-invitation", "governed-journey-next-action", "governed-journey-status"]) assert.ok(!targets.includes(unavailable), `invented unavailable target ${unavailable}`);
});

test("explains the real hierarchy without automatic opening", () => {
 const text = governanceSteps.map(step => step.body).join(" ");
 assert.match(text, /Portfolio/); assert.match(text, /Workspace/); assert.match(text, /Piloter, Explorer/);
});

test("uses the unique global Governance glossary", () => {
  assert.deepEqual(validateGlossaryReferences(governanceSteps.flatMap((step) => step.glossaryTermIds ?? [])), []);
  for (const [query, id] of [["gouvernance", "gouvernance"], ["rattacher", "rattachement"], ["pilotage transversal", "pilotage-global"], ["cockpit", "cockpit-consolide"], ["invitation gouvernée", "invitation-privee"]]) assert.ok(searchGlossary(query).some((term) => term.id === id), `missing global term ${id}`);
});

test("keeps Governance guidance free of business execution", () => {
  const boussole = read("components/ContextualBoussole.tsx");
  assert.doesNotMatch(boussole, /\.click\(\)/);
  assert.match(boussole, /scrollIntoView/);
  assert.match(boussole, /goodissima-boussole-highlight/);
  assert.doesNotMatch(read("lib/boussole-governance.ts"), /fetch\(|sendEmail|createWorkspace|attach.*Action/);
});
