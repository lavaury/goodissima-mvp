import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getMatchingContextForJourneyParticipantPicker, projectSafeMatchingExplanation } from "../lib/journey-matching-context.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("components/GovernedJourneyAddParticipantPanel.tsx");
const page = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");

function client(journey: unknown, runs: unknown[]) {
  return {
    governedJourney: { findFirst: async () => journey },
    matchingRun: { findMany: async () => runs },
  } as never;
}

const date = new Date("2026-09-25T12:00:00.000Z");
function run(id: string, title: string, templateId: string, target = "Cible") {
  return { id, status: "RESULTS_AVAILABLE", createdAt: date, completedAt: date, gLink: { id: `source-${id}`, title, templateId }, results: [{ status: "AVAILABLE", explanation: { compatibleElements: ["Zone compatible"], privateEmail: "secret@example.com" }, targetGLink: { id: `target-${id}`, title: target } }] };
}

test("authority is checked before matching runs are loaded", async () => {
  let queried = false;
  const result = await getMatchingContextForJourneyParticipantPicker({ currentUserId: "third-party", governedJourneyId: "journey" }, {
    governedJourney: { findFirst: async () => null },
    matchingRun: { findMany: async () => { queried = true; return []; } },
  } as never);
  assert.deepEqual(result, []);
  assert.equal(queried, false);
});

test("journey matching runs are prioritized without mixing their results", async () => {
  const result = await getMatchingContextForJourneyParticipantPicker({ currentUserId: "owner", governedJourneyId: "journey" }, client({ relationTemplateId: "journey-template" }, [run("other", "Autre recherche", "other-template"), run("journey", "Recherche du parcours", "journey-template")]));
  assert.deepEqual(result.map((item) => item.sourceLinkTitle), ["Recherche du parcours", "Autre recherche"]);
  assert.equal(result[0]?.results[0]?.targetLinkTitle, "Cible");
  assert.equal(result[0]?.results[0]?.invitableAsPerson, false);
  assert.match(result[0]?.results[0]?.nonInvitableReason ?? "", /ne permet pas d’identifier/);
});

test("explanations expose safe human text and never raw JSON", () => {
  const explanation = projectSafeMatchingExplanation({ compatibleElements: ["Métier compatible"], warnings: ["Disponibilité à confirmer"], email: "private@example.com", nested: { secret: true } });
  assert.deepEqual(explanation, ["Métier compatible", "Disponibilité à confirmer"]);
  assert.doesNotMatch(JSON.stringify(explanation), /private|secret|email/i);
});

test("picker shows source, date, counts, distinct runs and non-invitable link results", () => {
  for (const text of ["Matchings liés à ce Parcours", "Autres Matchings disponibles", "Matching du lien", "Exécuté le", "Lié à ce Parcours", "Pourquoi ce résultat ?", "Non invitable directement", "Voir le lien source", "Voir le lien résultat"]) assert.match(panel, new RegExp(text));
  assert.match(page, /getMatchingContextForJourneyParticipantPicker/);
  assert.match(page, /matchingContexts=\{matchingContexts\}/);
  assert.doesNotMatch(panel, /Matching #|Run 1234|MatchingRun\.id|MatchingResult\.id/);
});

test("only the newest related run is selected by default and external runs require a click", () => {
  assert.match(panel, /useState\(relatedMatchingRuns\[0\]\?\.runId \?\? ""\)/);
  assert.doesNotMatch(panel, /\?\? matchingContexts\[0\]/);
  assert.match(panel, /relatedMatchingRuns\.map/);
  assert.match(panel, /otherMatchingRuns\.map/);
  assert.match(panel, /<details className="mt-4 rounded-lg border bg-white">/);
  assert.match(panel, /Aucun Matching n’est actuellement lié à ce Parcours/);
  assert.match(panel, /Aucun Matching disponible pour le moment/);
});

test("directory and direct invitation contracts remain present", () => {
  assert.match(panel, /actorType: "PERSON"/);
  assert.match(panel, /source: "DIRECTORY"/);
  assert.match(panel, /Invitation directe/);
  assert.match(panel, /\/api\/gouvernance\/invitations/);
});
