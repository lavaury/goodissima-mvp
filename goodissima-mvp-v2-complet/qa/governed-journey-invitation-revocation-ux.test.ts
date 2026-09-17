import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const component = read("components/GovernedJourneyPendingInvitationActions.tsx");
const route = read("app/api/gouvernance/invitations/[id]/revoke/route.ts");
const service = read("lib/governed-journey-guest-access.ts");

test("revocation uses an inline human confirmation without native popup", () => {
  assert.doesNotMatch(component, /window\.confirm|\bconfirm\s*\(/);
  assert.match(component, /Révoquer l’invitation de \$\{visibleName\}/);
  assert.match(component, /Révoquer cette invitation \?/);
  assert.match(component, /L’historique de l’invitation sera conservé/);
  assert.match(component, /Annuler/);
  assert.match(component, /Confirmer la révocation/);
});

test("cancel stays local, performs no mutation and restores focus", () => {
  const cancelBody = component.match(/function cancel\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.doesNotMatch(cancelBody, /fetch|router/);
  assert.match(cancelBody, /setConfirming\(false\)/);
  assert.match(cancelBody, /revokeButtonRef\.current\?\.focus/);
});

test("confirmation is single-flight, human on error and refreshes after success", () => {
  assert.match(component, /if \(busy\) return/);
  assert.match(component, /disabled=\{busy\}/);
  assert.match(component, /Révocation…/);
  assert.match(component, /La révocation n’a pas pu être effectuée\./);
  assert.match(component, /router\.refresh\(\)/);
});

test("inline confirmation remains keyboard, focus and mobile friendly", () => {
  assert.match(component, /cancelButtonRef\.current\?\.focus/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /aria-live="assertive"/);
  assert.match(component, /min-h-11/);
  assert.match(component, /flex-col gap-2 sm:flex-row/);
  assert.match(component, /focus-visible:ring-2/);
});

test("existing owner-scoped server revocation and assignment release are reused", () => {
  assert.match(component, /\/api\/gouvernance\/invitations\/\$\{invitationId\}\/revoke/);
  assert.match(route, /ownerId: owner\.id/);
  assert.match(route, /revokeGovernedJourneyInvitationAccess/);
  assert.match(service, /governedJourneyExpectedRoleAssignment\.updateMany/);
  assert.match(service, /type: "REVOKED"/);
});
