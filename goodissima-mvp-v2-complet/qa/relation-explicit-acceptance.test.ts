import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acceptPublicRelationRequest, declinePublicRelationRequest } from "../lib/public-relation-request.ts";

function fixture() {
  const state: any = { request: { id: "request-1", gLinkId: "link-1", status: "PENDING", relationCaseId: null, requesterIdentityId: "identity-1", requestPayload: { candidateName: "Ada", candidateEmail: "ada@example.test", candidateEmailNotificationsEnabled: false, message: "Bonjour", documentName: "", documentUrl: "", relationTemplateId: null, formSubmission: null }, gLink: { id: "link-1", ownerId: "owner", title: "Projet" } }, cases: [], audits: [] };
  const tx: any = { $executeRaw: async () => 1, publicCaseCreationRequest: { findUnique: async () => state.request, update: async ({ data }: any) => Object.assign(state.request, data) }, goodissimaIdentity: { create: async () => ({ id: "new-identity" }) }, relationCase: { create: async ({ data }: any) => { const item = { id: `case-${state.cases.length + 1}`, ...data }; state.cases.push(item); return item; } }, message: { create: async () => ({ id: "message" }) }, document: { create: async () => ({ id: "document" }) }, auditLog: { create: async ({ data }: any) => { state.audits.push(data); } } };
  const client: any = { $transaction: async (run: any) => run(tx) };
  return { state, client };
}

test("a request creates no case before explicit acceptance and double acceptance creates exactly one", async () => {
  const setup = fixture(); assert.equal(setup.state.cases.length, 0);
  const first = await acceptPublicRelationRequest(setup.client, { requestId: "request-1", actorUserId: "owner", actorEmail: "owner@example.test" });
  const replay = await acceptPublicRelationRequest(setup.client, { requestId: "request-1", actorUserId: "owner", actorEmail: "owner@example.test" });
  assert.equal(setup.state.cases.length, 1); assert.equal(first.relationCaseId, replay.relationCaseId); assert.equal(replay.replayed, true); assert.equal(setup.state.request.status, "ACCEPTED");
});

test("decline keeps history and creates no case", async () => {
  const setup = fixture(); await declinePublicRelationRequest(setup.client, { requestId: "request-1", actorUserId: "owner", actorEmail: "owner@example.test", reason: "Pas maintenant" });
  assert.equal(setup.state.cases.length, 0); assert.equal(setup.state.request.status, "DECLINED"); assert.equal(setup.state.request.declineReason, "Pas maintenant"); assert.equal(setup.state.audits[0].eventType, "RELATION_REQUEST_DECLINED");
});

test("a third party and the requester cannot decide for the owner", async () => {
  for (const actorUserId of ["third-party", "requester"]) await assert.rejects(acceptPublicRelationRequest(fixture().client, { requestId: "request-1", actorUserId, actorEmail: `${actorUserId}@example.test` }), /RELATION_REQUEST_NOT_FOUND/);
});

test("migration is additive and protects the explicit decision states", () => {
  const sql = readFileSync("prisma/migrations/20260925120000_add_explicit_public_relation_acceptance/migration.sql", "utf8");
  assert.doesNotMatch(sql, /DROP\s+(?:TABLE|COLUMN)|DELETE\s+FROM|UPDATE\s+"PublicCaseCreationRequest"/i);
  for (const value of ["requestPayload", "decidedAt", "decidedByUserId", "PENDING", "ACCEPTED", "DECLINED"]) assert.match(sql, new RegExp(value));
});
