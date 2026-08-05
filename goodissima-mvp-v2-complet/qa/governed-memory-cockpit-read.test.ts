import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGovernedMemoryCockpitView, type GovernedMemoryCockpitRawItem } from "../lib/governed-journey/cockpit/memory-read-model.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const component = read("components/governed-journey/GovernedMemoryCockpitSection.tsx");
const service = read("lib/governed-journey/cockpit/memory-read-service.ts");
const repository = read("lib/governed-journey/cockpit/memory-read-repository.ts");

function raw(overrides: Partial<GovernedMemoryCockpitRawItem> = {}): GovernedMemoryCockpitRawItem {
  return {
    id: "memory-a", type: "FACT", title: null, text: "Contenu explicite", kind: null,
    status: "PROPOSED", recordedAt: new Date("2026-08-01T10:00:00.000Z"), sourceEventOccurredAt: null,
    validation: null, dispute: null, hasExplicitContext: true, ...overrides,
  };
}

test("distinguishes no extension, empty memory and available memory", () => {
  assert.deepEqual(buildGovernedMemoryCockpitView({ hasExtension: false, items: [] }), { availability: "NO_EXTENSION", visibleCount: 0, items: [] });
  assert.deepEqual(buildGovernedMemoryCockpitView({ hasExtension: true, items: [] }), { availability: "EMPTY", visibleCount: 0, items: [] });
  const available = buildGovernedMemoryCockpitView({ hasExtension: true, items: [raw()] });
  assert.equal(available.availability, "AVAILABLE");
  assert.equal(available.visibleCount, available.items.length);
});

test("projects every real persisted state without filtering", () => {
  const states = [
    ["FACT", "PROPOSED", "Proposée", false], ["FACT", "ESTABLISHED", "Établie", true],
    ["FACT", "DISPUTED", "Contestée", false], ["FACT", "SUPERSEDED", "Remplacée", false],
    ["DECISION", "DRAFT", "Brouillon enregistré", false], ["DECISION", "VALIDATED", "Validée humainement", true],
    ["DECISION", "SUPERSEDED", "Remplacée", false], ["DECISION", "CANCELLED", "Annulée", false],
    ["SOURCE", "ACTIVE", "Active", true], ["SOURCE", "ARCHIVED", "Archivée", false],
    ["SOURCE", "RESTRICTED", "Restreinte", false], ["SOURCE", "EXPIRED", "Expirée", false],
    ["SOURCE", "ANONYMIZED", "Anonymisée", false], ["SOURCE", "DELETED", "Supprimée logiquement", false],
    ["SOURCE", "LEGAL_HOLD", "Conservée sous obligation légale", true],
  ] as const;
  const items = states.map(([type, status], index) => raw({ id: `item-${index}`, type, status, kind: type === "SOURCE" ? "DOCUMENT" : null }));
  const view = buildGovernedMemoryCockpitView({ hasExtension: true, items });
  assert.equal(view.visibleCount, states.length);
  for (const [, status, label, isActive] of states) {
    const item = view.items.find((candidate) => candidate.state.code === status);
    assert.ok(item);
    assert.equal(item.state.label, label);
    assert.equal(item.state.isActive, isActive);
  }
});

test("orders deterministically and exposes safe content, provenance, validation and context", () => {
  const view = buildGovernedMemoryCockpitView({ hasExtension: true, items: [
    raw({ id: "older", recordedAt: new Date("2026-08-01T10:00:00.000Z") }),
    raw({
      id: "newer", type: "SOURCE", title: "Titre", text: "Extrait autorisé", kind: "HUMAN_DECLARATION", status: "ACTIVE",
      recordedAt: new Date("2026-08-02T10:00:00.000Z"), sourceEventOccurredAt: new Date("2026-08-02T09:00:00.000Z"),
      validation: { decision: "REJECTED", validatedAt: new Date("2026-08-03T10:00:00.000Z") },
      dispute: { status: "OPEN" },
    }),
  ] });
  assert.equal(view.items[0].content.text, "Extrait autorisé");
  assert.equal(view.items[0].provenance?.label, "Issue d’un événement gouverné");
  assert.equal(view.items[0].humanValidation?.label, "Rejetée humainement");
  assert.equal(view.items[0].state.isActive, true, "a rejected validation does not rewrite the persisted source state");
  assert.equal(view.items[0].disputeLabel, "Contestation ouverte");
  assert.equal(view.items[0].contextLabel, "Contexte dossier rattaché");
  assert.match(view.items[0].publicKey, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(view), /memory-a|newer|older|governedJourneyId|relationCaseId|validatorUserId|authorityUserId/);
});

test("anchors authorization on the active owned cockpit then applies stricter memory permissions", () => {
  assert.match(repository, /formTemplate\.findFirst/);
  assert.match(repository, /workspace: \{ ownerId: input\.requesterUserId, status: "ACTIVE" \}/);
  assert.match(service, /resolveMemoryPermissions/);
  assert.match(service, /canViewMemoryObject/);
  assert.match(service, /access\.permissions\.has\("VIEW_MEMORY"\)/);
  assert.doesNotMatch(service, /authorityUserId|invitation|participant|session|communication/i);
});

test("loads all linked memory in bounded batches without state filters or full journal", () => {
  assert.match(repository, /governedJourneyId: input\.governedJourneyId/);
  assert.match(repository, /governedMemoryRelation\.findMany/);
  assert.match(repository, /Promise\.all/);
  assert.doesNotMatch(repository, /status: \{ in:|take:|cursor:|governedMemoryEvent\.find|events:/);
  assert.match(repository, /governedJourneyEvent: \{ select: \{ occurredAt: true \} \}/);
  assert.doesNotMatch(repository, /include:/);
});

test("renders the memory section directly below R3 without actions or identifiers", () => {
  assert.match(page, /<GovernedJourneyCockpitCard[\s\S]*<GovernedMemoryCockpitSection/);
  for (const text of ["Mémoire gouvernée", "Ce parcours historique ne possède pas encore d’extension de mémoire gouvernée", "Aucune mémoire gouvernée n’a encore été enregistrée", "Provenance", "Validation humaine", "Contexte"]) assert.match(component, new RegExp(text));
  assert.match(component, /<article key=\{item\.publicKey\}/);
  assert.doesNotMatch(component, /\{item\.publicKey\}<|<button|<form|action=|href=|onClick|state\.code|governedJourneyId|relationCaseId|authorityUserId|JSON/i);
});

test("keeps R4 read-only and parallel routes frozen", () => {
  assert.doesNotMatch(`${service}\n${repository}`, /\.(?:create|update|updateMany|upsert|delete|deleteMany)\s*\(/);
  assert.doesNotMatch(`${service}\n${repository}\n${component}`, /OpenAI|Mistral|generate|notification|backfill/i);
  for (const path of ["app/cases/[caseId]/journeys/page.tsx", "app/cases/[caseId]/journeys/[journeyId]/page.tsx"]) assert.match(read(path), /notFound\(\)/);
});
