import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("governed invitation copy has success and manual-selection fallback", () => {
  const panel = source("components/GovernedJourneyGuestAccessPanel.tsx");
  assert.match(panel, /navigator\.clipboard\.writeText\(link\)/);
  assert.match(panel, /linkInputRef\.current\?\.select\(\)/);
  assert.match(panel, /Lien copie/);
  assert.match(panel, /Copie impossible, selectionnez le lien manuellement/);
  assert.doesNotMatch(panel, /console\./);
});

test("participant UI refreshes session states without auto-joining", () => {
  const refresh = source("components/GovernedInvitationStatusRefresh.tsx");
  const page = source("app/gouvernance/invitation/[token]/page.tsx");
  assert.match(refresh, /router\.refresh\(\)/);
  assert.match(refresh, /visibilityState === "visible"/);
  assert.match(page, /"En direct"/);
  assert.match(page, /"Preparee"/);
  assert.match(page, /"Terminee"/);
  assert.match(page, /const live = session\.status === "REQUESTED"/);
  assert.doesNotMatch(refresh, /getUserMedia|livekit|join/i);
});

test("Workspace CTA names the governed journey creation flow", () => {
  const page = source("app/gouvernance/page.tsx");
  assert.match(page, /href="\/gouvernance\/nouveau"[\s\S]*Creer un parcours gouverne/);
  assert.doesNotMatch(page, /Commencer une activite/);
});

test("journey Workspace change requires owner scope and explicit confirmation", () => {
  const page = source("app/gouvernance/parcours/[id]/pilotage/page.tsx");
  const actions = source("lib/governance-workspace-actions.ts");
  assert.match(page, /changeGovernedJourneyWorkspaceAction/);
  assert.match(page, /name="humanConfirmed" value="yes"/);
  assert.match(actions, /workspaceId,\s*ownerId: owner\.id,\s*status: "ACTIVE"/);
  assert.match(actions, /humanConfirmed/);
  assert.doesNotMatch(actions, /send.*Email|notification/i);
});
