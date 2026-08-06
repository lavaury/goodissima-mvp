import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) => readFileSync(path, "utf8");
const panel = read("components/governed-journey/GovernedMemoryRolesPanel.tsx");
const service = read("lib/governed-memory/cockpit-role-service.ts");

test("memory functions list is owner-scoped, human-readable and revocable", () => {
  assert.match(panel, /Responsable de la mémoire/); assert.match(panel, /Responsable|roleLabel/); assert.match(panel, /Révoquer cette fonction/); assert.match(panel, /actions historiques déjà réalisées resteront conservées/);
  assert.match(service, /workspace: \{ ownerId: input\.requesterUserId, status: "ACTIVE" \}/);
  assert.match(service, /revokedAt: null/); assert.match(service, /buildPublicJourneyMemoryRoleKey/);
  assert.doesNotMatch(panel, /userId|assignmentId|governedJourneyId|relationTemplateId|grantedByUserId|MEMORY_STEWARD|MEMORY_DELEGATE/);
});

test("the self-service exception introduces no unsafe third-party attribution", () => {
  assert.match(panel, /l’organisateur peut prendre cette fonction directement/);
  assert.doesNotMatch(panel, /name="userId"|type="email"|Annuaire|invitation|Attribuer la fonction/);
});
