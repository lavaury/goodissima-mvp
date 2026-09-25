import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (file: string) => readFileSync(file, "utf8");

function fixture() {
  const saved = new Map<string, any>();
  let sequence = 0;
  const notification = {
    async create({ data }: any) {
      if (saved.has(data.idempotencyKey)) throw new Error("unique idempotencyKey");
      const row = { id: `n-${++sequence}`, createdAt: new Date(sequence), readAt: null, ...data };
      saved.set(data.idempotencyKey, row);
      return row;
    },
    async createMany({ data }: any) {
      let count = 0;
      for (const input of data) if (!saved.has(input.idempotencyKey)) {
        const row = { id: `n-${++sequence}`, createdAt: new Date(sequence), readAt: null, ...input };
        saved.set(input.idempotencyKey, row); count++;
      }
      return { count };
    },
    async findUniqueOrThrow({ where }: any) {
      const row = saved.get(where.idempotencyKey);
      if (!row) throw new Error("missing notification");
      return row;
    },
    async findMany({ where, take, skip }: any) {
      assert.ok(take >= 1 && take <= 50);
      assert.ok(skip >= 0 && skip <= 50_000);
      return [...saved.values()]
        .filter(row => row.recipientUserId === where.recipientUserId && (where.readAt !== null || row.readAt === null))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(skip, skip + take)
        .map(publicRow);
    },
    async count({ where }: any) {
      return [...saved.values()].filter(row => row.recipientUserId === where.recipientUserId && row.readAt === null).length;
    },
    async updateMany({ where, data }: any) {
      let count = 0;
      for (const row of saved.values()) if (row.id === where.id && row.recipientUserId === where.recipientUserId && row.readAt === null) {
        row.readAt = data.readAt; count++;
      }
      return { count };
    },
    async findFirst({ where }: any) {
      const row = [...saved.values()].find(item => item.id === where.id && item.recipientUserId === where.recipientUserId);
      return row ? publicRow(row) : null;
    },
  };
  const repository = loadTestModule<any>("lib/notification-repository.ts", { "@/lib/prisma": { prisma: { notification } } });
  return { repository, saved };
}

function publicRow(row: any) {
  return { id: row.id, type: row.type, relationCaseId: row.relationCaseId, createdAt: row.createdAt, readAt: row.readAt };
}

test("schema and additive migration persist only the V1 privacy-first contract", () => {
  const schema = read("prisma/schema.prisma");
  const model = schema.match(/model Notification \{([\s\S]*?)\n\}/)![1];
  for (const field of ["recipientUserId", "type", "relationCaseId", "sourceEventId", "idempotencyKey", "createdAt", "readAt"]) assert.match(model, new RegExp(`\\b${field}\\b`));
  assert.match(model, /@@index\(\[recipientUserId, readAt, createdAt\]\)/);
  assert.match(model, /idempotencyKey\s+String\s+@unique/);
  assert.doesNotMatch(model, /message|excerpt|email|token|alias|workspaceId|matching|trust|identity/i);
  const sql = read("prisma/migrations/20260913120000_add_notification_foundation/migration.sql");
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 1);
  assert.match(sql, /CREATE TYPE "NotificationType" AS ENUM \('NEW_RELATION_CASE', 'NEW_MESSAGE'\)/);
  assert.doesNotMatch(sql, /^\s*(?:DROP|UPDATE |DELETE FROM|TRUNCATE|ALTER TYPE)/m);
});

test("creation is idempotent and isolated by deterministic recipient-aware keys", async () => {
  const { repository, saved } = fixture();
  const input = { recipientUserId: "alice", type: "NEW_RELATION_CASE", relationCaseId: "case-1", sourceEventId: "event-1", idempotencyKey: repository.relationCaseNotificationKey("case-1", "alice") };
  await Promise.all([repository.createNotificationOnce(input), repository.createNotificationOnce(input)]);
  assert.equal(saved.size, 1);
  await repository.createNotificationOnce({ ...input, recipientUserId: "bob", idempotencyKey: repository.relationCaseNotificationKey("case-1", "bob") });
  assert.equal(saved.size, 2);
});

test("list, unread count and read lifecycle are user-scoped, bounded and idempotent", async () => {
  const { repository } = fixture();
  for (const [recipientUserId, messageId] of [["alice", "m1"], ["alice", "m2"], ["bob", "m3"]]) await repository.createNotificationOnce({ recipientUserId, type: "NEW_MESSAGE", relationCaseId: "case-1", idempotencyKey: repository.messageNotificationKey(messageId, recipientUserId) });
  const alice = await repository.listNotificationsForUser("alice", { limit: 500 });
  assert.equal(alice.length, 2); assert.ok(alice.every((row: any) => !Object.hasOwn(row, "recipientUserId")));
  assert.equal(await repository.countUnreadNotificationsForUser("alice"), 2);
  assert.equal(await repository.markNotificationRead(alice[0].id, "bob"), null);
  const firstRead = await repository.markNotificationRead(alice[0].id, "alice");
  const secondRead = await repository.markNotificationRead(alice[0].id, "alice");
  assert.equal(firstRead.readAt, secondRead.readAt);
  assert.equal(await repository.countUnreadNotificationsForUser("alice"), 1);
});

test("API derives ownership from the authenticated session and exposes only safe fields", async () => {
  const safe = { id: "n1", type: "NEW_MESSAGE", relationCaseId: "c1", createdAt: new Date(), readAt: null };
  const dependencies = {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "session-user" }) },
    "@/lib/notification-repository": {
      countUnreadNotificationsForUser: async (id: string) => { assert.equal(id, "session-user"); return 1; },
      markNotificationRead: async (_id: string, userId: string) => { assert.equal(userId, "session-user"); return safe; },
    },
    "@/lib/notification-projection": { getNotificationViewsForUser: async (id: string) => { assert.equal(id, "session-user"); return { items: [safe], hasMore: false }; } },
    "@/lib/pending-relation-request-attention": { getPendingRelationRequestAttentionForUser: async (id: string) => { assert.equal(id, "session-user"); return []; } },
  };
  const list = loadTestModule<any>("app/api/notifications/route.ts", dependencies);
  const payload = await (await list.GET(new Request("https://goodissima.test/api/notifications?limit=999"))).json();
  assert.deepEqual(payload, { notifications: [{ ...safe, createdAt: safe.createdAt.toISOString() }], hasMore: false, unreadCount: 1 });
  const patch = loadTestModule<any>("app/api/notifications/[id]/route.ts", dependencies);
  assert.equal((await patch.PATCH(new Request("https://goodissima.test", { method: "PATCH", body: JSON.stringify({ read: false }) }), { params: { id: "n1" } })).status, 400);
  const response = await patch.PATCH(new Request("https://goodissima.test", { method: "PATCH", body: JSON.stringify({ read: true }) }), { params: { id: "n1" } });
  const responseBody = await response.json();
  assert.deepEqual(Object.keys(responseBody).sort(), ["createdAt", "id", "readAt", "relationCaseId", "type"]);
  const serialized = JSON.stringify(responseBody);
  for (const forbidden of ["recipientUserId", "sourceEventId", "idempotencyKey", "candidateAccessToken", "email", "body", "excerpt", "workspaceId", "ownerId", "matching", "trust", "identity"]) assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
});

test("business routes emit exactly the two scoped notification types without changing email or UI", () => {
  const cases = read("app/api/cases/route.ts");
  const messages = read("app/api/messages/route.ts");
  assert.match(cases, /type: "CASE_CREATED"/);
  assert.match(cases, /type: "NEW_RELATION_CASE"/);
  assert.equal((cases.match(/type: "NEW_MESSAGE"/g) ?? []).length, 1, "only the existing-case message path emits NEW_MESSAGE");
  assert.match(messages, /body\.senderType === "CANDIDATE" \? await createNotificationOnce\(\{[\s\S]*type: "NEW_MESSAGE"/);
  assert.equal((messages.match(/type: "NEW_MESSAGE"/g) ?? []).length, 1);
  assert.match(messages, /prisma\.\$transaction/);
  assert.match(cases, /maybeSendNotificationEmail/); assert.match(messages, /maybeSendNotificationEmail/);
  assert.doesNotMatch(read("components/DashboardHome.tsx"), /notification-repository/);
});
