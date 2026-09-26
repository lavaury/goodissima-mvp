import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { projectPublicRelationRequestHistory } from "../lib/public-relation-request-history.ts";

const createdAt = new Date("2026-09-26T15:30:00Z");
const decidedAt = new Date("2026-09-26T15:33:00Z");
const base = { id: "request-1", status: "PENDING", createdAt, decidedAt: null, decidedByUserId: null, declineReason: null, relationCaseId: null, decidedByUser: null, relationCase: null };

test("pending history contains only the proven creation", () => {
  assert.deepEqual(projectPublicRelationRequestHistory(base, [{ eventType: "RELATION_REQUEST_DECISION_NOTIFICATION_SENT", createdAt: new Date(), metadata: { requestId: "request-1" } }]), [{ type: "REQUEST_CREATED", occurredAt: createdAt.toISOString(), label: "Demande envoyée" }]);
});

test("accepted history contains the decision and only a real resulting case", () => {
  const history = projectPublicRelationRequestHistory({ ...base, status: "ACCEPTED", decidedAt, decidedByUserId: "owner", decidedByUser: { name: "Alice" }, relationCaseId: "case-1", relationCase: { id: "case-1", createdAt: new Date("2026-09-26T15:33:01Z") } });
  assert.deepEqual(history.map((event) => event.type), ["REQUEST_CREATED", "REQUEST_ACCEPTED", "CASE_CREATED"]);
  assert.equal(history[1].actorLabel, "Décision prise par Alice");
  assert.equal(history[2].label, "Dossier créé");
});

test("declined history contains its real reason without inventing a case", () => {
  const history = projectPublicRelationRequestHistory({ ...base, status: "DECLINED", decidedAt, declineReason: "Credentials insuffisants" });
  assert.deepEqual(history.map((event) => event.type), ["REQUEST_CREATED", "REQUEST_DECLINED"]);
  assert.equal(history[1].detail, "Credentials insuffisants");
  assert.equal(history[1].actorLabel, undefined);
});

test("only bound notification audits are projected with human labels", () => {
  const request = { ...base, status: "DECLINED", decidedAt };
  const audits = [
    { eventType: "RELATION_REQUEST_DECISION_NOTIFICATION_SENT", createdAt: new Date("2026-09-26T15:34:00Z"), metadata: { requestId: "request-1" } },
    { eventType: "RELATION_REQUEST_DECISION_NOTIFICATION_SKIPPED", createdAt: new Date("2026-09-26T15:35:00Z"), metadata: { requestId: "request-1" } },
    { eventType: "RELATION_REQUEST_DECISION_NOTIFICATION_FAILED", createdAt: new Date("2026-09-26T15:36:00Z"), metadata: { requestId: "request-1" } },
    { eventType: "RELATION_REQUEST_DECISION_NOTIFICATION_SENT", createdAt: new Date(), metadata: { requestId: "another-request", privateEmail: "secret@example.test" } },
    { eventType: "UNRELATED_TECHNICAL_EVENT", createdAt: new Date(), metadata: { requestId: "request-1" } },
  ];
  const history = projectPublicRelationRequestHistory(request, audits);
  assert.deepEqual(history.slice(2).map((event) => event.label), ["Demandeur prévenu par e-mail", "Aucune notification e-mail demandée", "La notification e-mail n'a pas pu être délivrée"]);
  assert.doesNotMatch(JSON.stringify(history), /secret@example|RELATION_REQUEST_DECISION|UNRELATED/);
});

test("incomplete historical data never fabricates decision, actor, case or notification", () => {
  const history = projectPublicRelationRequestHistory({ ...base, status: "ACCEPTED", decidedByUserId: "missing", relationCaseId: "missing" }, [{ eventType: "RELATION_REQUEST_DECISION_NOTIFICATION_SENT", createdAt: new Date(), metadata: null }]);
  assert.deepEqual(history.map((event) => event.type), ["REQUEST_CREATED"]);
  const emailName = projectPublicRelationRequestHistory({ ...base, status: "DECLINED", decidedAt, decidedByUserId: "owner", decidedByUser: { name: "private@example.test" } });
  assert.equal(emailName[1].actorLabel, undefined);
});

test("owner UI keeps current status separate from a collapsed history", () => {
  const panel = readFileSync(new URL("../components/RelationRequestsPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /labels\[request\.status\]/);
  assert.match(panel, /<details className="mt-3"><summary[^>]*>Historique de la demande<\/summary>/);
});
