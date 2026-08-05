import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildGovernedJourneyCockpitView } from "../lib/governed-journey/cockpit/read-model.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cockpitPage = read("app/gouvernance/parcours/[id]/pilotage/page.tsx");
const cockpitService = read("lib/governed-journey/cockpit/read-service.ts");
const card = read("components/governed-journey/GovernedJourneyCockpitCard.tsx");
const journeyRepository = read("lib/governed-journey/read/repository.ts");
const contextRepository = read("lib/governed-journey/context/repository.ts");

function viewFixture(options: { extension?: boolean; contextCount?: number; legacy?: boolean; sourceVersion?: number | null } = {}) {
  const extension = options.extension ?? true;
  const contextCount = options.contextCount ?? 0;
  return buildGovernedJourneyCockpitView({
    relationTemplateId: "rt-a",
    extension: extension ? {
      id: "gj-a",
      relationCaseId: options.legacy ? "case-legacy" : null,
      createdAt: "2026-08-10T12:00:00.000Z",
      createdFromTemplateVersionNumber: options.sourceVersion === undefined ? 3 : options.sourceVersion,
    } : null,
    contextGovernedJourneyId: extension ? "gj-a" : null,
    contextCount,
  });
}

test("builds the bounded cockpit DTO with the exact source version", () => {
  assert.deepEqual(viewFixture({ contextCount: 2, legacy: true, sourceVersion: 3 }), {
    relationTemplateId: "rt-a",
    extension: {
      createdAt: "2026-08-10T12:00:00.000Z",
      createdFromVersionLabel: "version 3",
      hasLegacyEventLog: true,
      contextCount: 2,
    },
  });
});

test("supports an authorized historical cockpit without an extension", () => {
  assert.deepEqual(viewFixture({ extension: false }), { relationTemplateId: "rt-a", extension: null });
});

test("preserves context counts and unavailable source metadata", () => {
  for (const contextCount of [0, 1, 4]) {
    const result = viewFixture({ contextCount, sourceVersion: null });
    assert.equal(result.extension?.contextCount, contextCount);
    assert.equal(result.extension?.createdFromVersionLabel, null);
    assert.equal(result.extension?.hasLegacyEventLog, false);
  }
});

test("keeps both reads owner-scoped through the active Workspace", () => {
  for (const repository of [journeyRepository, contextRepository]) {
    assert.match(repository, /workspace: \{ ownerId: requesterUserId, status: "ACTIVE" as const \}/);
  }
  assert.match(cockpitPage, /requesterUserId: owner\.id/);
  assert.match(cockpitPage, /error\.code === "NOT_FOUND"\) notFound\(\)/);
  assert.doesNotMatch(cockpitService, /authorityUserId|invitation|session|permission|grant/i);
});

test("does not load events, memory or expose internal ledger fields", () => {
  assert.match(cockpitService, /Promise\.all/);
  assert.doesNotMatch(cockpitService, /listLegacyEvents|governedJourneyEvent|governedMemory|prisma\./);
  for (const forbidden of ["ledgerStatus", "authorityUserId", "relationCaseId", "currentStepKey", "requestKey", "fingerprint"]) {
    assert.doesNotMatch(card, new RegExp(forbidden, "i"));
  }
});

test("renders a read-only governance block in the canonical FormTemplate cockpit", () => {
  assert.match(cockpitPage, /GovernedJourneyCockpitCard view=\{governedJourneyCockpitView\}/);
  assert.match(card, /Gouvernance du parcours/);
  assert.match(card, /Ce parcours historique ne possède pas encore d’extension de journal gouverné/);
  assert.match(card, /Extension gouvernée active/);
  assert.match(card, /Version source de l’extension/);
  assert.match(card, /Journal historique disponible/);
  assert.match(card, /Journal global non encore activé/);
  assert.doesNotMatch(card, /<button|<form|action=|href=|onClick|ledger/i);
  assert.doesNotMatch(cockpitPage, /components\/governed-journey\/(?:GovernedJourneyList|GovernedJourneyDetail)/);
  assert.doesNotMatch(cockpitPage, /governedJourney.*\.create|createGovernedJourneyAction/);
});

test("keeps GJ-4 frozen and adds no schema or route", () => {
  for (const path of ["app/cases/[caseId]/journeys/page.tsx", "app/cases/[caseId]/journeys/[journeyId]/page.tsx"]) {
    assert.match(read(path), /notFound\(\)/);
  }
  assert.doesNotMatch(cockpitService, /\.(?:create|update|upsert|delete)\s*\(|attachRelationCase|backfill/i);
});
