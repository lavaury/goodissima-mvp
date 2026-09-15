import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JOURNEY_HISTORY_INITIAL_COUNT, orderJourneyHistory } from "../lib/governed-journey-history.ts";

test("la chronologie fusionnée utilise le timestamp puis une clé déterministe", () => {
  const items = orderJourneyHistory([
    { key: "a", occurredAt: "2026-09-15T10:00:00.000Z", text: "A", source: "memory" },
    { key: "c", occurredAt: "2026-09-15T11:00:00.000Z", text: "C", source: "meeting" },
    { key: "b", occurredAt: "2026-09-15T10:00:00.000Z", text: "B", source: "document" },
  ]);
  assert.deepEqual(items.map((item) => item.key), ["c", "b", "a"]);
  assert.equal(JOURNEY_HISTORY_INITIAL_COUNT, 12);
});

test("Historique reste distinct de l'état courant, borné et sans action métier", () => {
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf("<GovernedJourneyMemorySection") < page.indexOf('<section id="history"'));
  assert.match(page, /JOURNEY_HISTORY_INITIAL_COUNT/);
  assert.match(page, /Afficher plus/);
  assert.match(page, /<time dateTime=/);
  assert.match(page, /overflow|break-words|min-w-0/);
  const history = page.slice(page.indexOf('<section id="history"'), page.indexOf("</section>", page.indexOf('<section id="history"')));
  assert.doesNotMatch(history, /Confirmer comme fait|Contester|Réviser|Annuler/);
});

test("les sources historiques existantes et la mémoire sont fusionnées une seule fois", () => {
  const page = readFileSync(new URL("../app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx", import.meta.url), "utf8");
  for (const source of ["participantInvitations.map", "documentReceptions.map", "governanceReviewPreparations.map", "communicationOverview.sessions.map", "governedMemory?.history"]) assert.match(page, new RegExp(source.replace(/[?.]/g, "\\$&")));
  assert.doesNotMatch(page, /governanceReviewPreparations\.slice/);
});
