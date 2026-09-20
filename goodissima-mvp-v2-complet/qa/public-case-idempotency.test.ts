import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalPublicCasePayload,
  cleanupExpiredPublicCaseRequests,
  hashPublicCaseIdempotencyKey,
  hashPublicCasePayload,
  PUBLIC_CASE_IDEMPOTENCY_TTL_MS,
  readPublicCaseIdempotencyKey,
  reservePublicCaseRequest,
} from "../lib/public-case-idempotency.ts";

test("idempotency keys are bounded, opaque and HMACed with domain separation", () => {
  assert.equal(readPublicCaseIdempotencyKey(new Headers()).key, null);
  for (const invalid of ["short", "contains spaces", "x".repeat(201)]) {
    assert.equal(readPublicCaseIdempotencyKey(new Headers({ "Idempotency-Key": invalid })).ok, false);
  }
  const key = "0123456789abcdef0123456789abcdef";
  const secret = "s".repeat(32);
  const hash = hashPublicCaseIdempotencyKey(key, secret);
  assert.equal(hash.length, 64);
  assert.ok(!hash.includes(key));
  assert.notEqual(hash, hashPublicCasePayload({ key }));
  assert.throws(() => hashPublicCaseIdempotencyKey(key, "short"), /SECRET_UNAVAILABLE/);
});

test("payload canonicalization normalizes property order, absence, null and business strings", () => {
  const left = {
    message: " Bonjour ",
    gLinkId: " link ",
    candidateEmail: " USER@Example.Test ",
    answers: { z: null, a: ["one", "two"] },
    documentName: " note.pdf ",
    omitted: undefined,
  };
  const right = {
    documentName: "note.pdf",
    answers: { a: ["one", "two"], z: null },
    candidateEmail: "user@example.test",
    gLinkId: "link",
    message: "Bonjour",
  };
  assert.equal(canonicalPublicCasePayload(left), canonicalPublicCasePayload(right));
  assert.equal(hashPublicCasePayload(left), hashPublicCasePayload(right));
  assert.notEqual(hashPublicCasePayload(right), hashPublicCasePayload({ ...right, message: "Different" }));
});

test("atomic reservation returns one winner, pending retries, conflicts and completed replay", async () => {
  const rows = new Map<string, any>();
  let sequence = 0;
  const client = {
    $executeRaw: async () => 0,
    publicCaseCreationRequest: {
      create: async ({ data }: any) => {
        const unique = `${data.gLinkId}:${data.idempotencyKeyHash}`;
        if (rows.has(unique)) throw { code: "P2002" };
        const row = { id: `request-${++sequence}`, status: "PENDING", relationCaseId: null, ...data };
        rows.set(unique, row);
        return row;
      },
      findUnique: async ({ where }: any) => rows.get(`${where.gLinkId_idempotencyKeyHash.gLinkId}:${where.gLinkId_idempotencyKeyHash.idempotencyKeyHash}`) ?? null,
    },
  } as any;
  const input = { gLinkId: "link", idempotencyKeyHash: "key-hash", payloadHash: "payload-hash", now: new Date("2026-09-14T12:00:00Z") };
  const [first, second] = await Promise.all([
    reservePublicCaseRequest(client, input),
    reservePublicCaseRequest(client, input),
  ]);
  assert.deepEqual([first.kind, second.kind].sort(), ["PENDING", "RESERVED"]);
  const row = rows.get("link:key-hash");
  assert.equal(row.expiresAt.getTime() - input.now.getTime(), PUBLIC_CASE_IDEMPOTENCY_TTL_MS);
  assert.equal((await reservePublicCaseRequest(client, { ...input, payloadHash: "different" })).kind, "CONFLICT");
  row.status = "COMPLETED";
  row.relationCaseId = "case-1";
  assert.equal((await reservePublicCaseRequest(client, input)).kind, "COMPLETED");
});

test("cleanup is bounded and persistence contains no raw request or token fields", async () => {
  let cleanupSql: unknown;
  await cleanupExpiredPublicCaseRequests({
    $executeRaw: async (sql: unknown) => { cleanupSql = sql; return 1; },
    publicCaseCreationRequest: {} as never,
  } as any, new Date("2026-09-15T12:00:00Z"));
  assert.match(JSON.stringify(cleanupSql), /LIMIT/);

  const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
  const model = schema.match(/model PublicCaseCreationRequest \{[\s\S]*?\n\}/)?.[0] ?? "";
  for (const forbidden of ["candidateAccessToken", "idempotencyKey String", "message", "candidateEmail", "answers", "documentUrl"]) {
    assert.doesNotMatch(model, new RegExp(forbidden));
  }
  const route = readFileSync(new URL("../app/api/cases/route.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("checkPublicCaseCreationLimit") < route.indexOf("claimIdempotencyRequest()"));
  assert.match(route, /IDEMPOTENCY_CONFLICT/);
  assert.match(route, /IDEMPOTENCY_PENDING/);
});

test("both modern clients retain a key for the same serialized payload", () => {
  for (const file of [
    "../components/PublicOpportunitySecureExchange.tsx",
    "../app/l/[slug]/candidate-form.tsx",
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /Idempotency-Key/);
    assert.match(source, /submissionRef\.current\?\.payload/);
    assert.match(source, /createPublicCaseIdempotencyKey/);
  }
});
