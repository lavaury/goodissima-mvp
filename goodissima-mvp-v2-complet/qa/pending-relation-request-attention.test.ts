import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("pending attention is owner-scoped, pending-only and exposes a minimal projection", async () => {
  const calls: any[] = [];
  const rows = [
    { id: "request-1", gLinkId: "old-link", createdAt: new Date("2026-09-25T10:00:00Z"), requestPayload: { candidateName: "Ada", candidateEmail: "ada@example.test", privateAnswer: "secret" }, gLink: { id: "old-link", title: "Lien existant", rules: { simpleLink: true }, templateId: null } },
    { id: "invalid", gLinkId: "old-link", createdAt: new Date(), requestPayload: { candidateName: "Incomplet" }, gLink: { id: "old-link", title: "Lien existant", rules: { simpleLink: true }, templateId: null } },
  ];
  const projection = loadTestModule<any>("lib/pending-relation-request-attention.ts", {
    "@prisma/client": { Prisma: { DbNull: Symbol("DbNull") } },
    "@/lib/prisma": { prisma: { publicCaseCreationRequest: { findMany: async (query: any) => { calls.push(query); return rows; } } } },
    "@/lib/opportunities/opportunity-projection": { relationRequestOwnerHref: (link: any, requestId: string) => `/links/${link.id}#relation-request-${requestId}` },
  });
  const result = await projection.getPendingRelationRequestAttentionForUser("owner-1");
  assert.deepEqual(calls[0].where.status, "PENDING");
  assert.deepEqual(calls[0].where.gLink, { ownerId: "owner-1" });
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { kind: "RELATION_REQUEST_ATTENTION", requestId: "request-1", gLinkId: "old-link", title: "Lien existant", candidateName: "Ada", createdAt: rows[0].createdAt, href: "/links/old-link#relation-request-request-1" });
  for (const forbidden of ["candidateEmail", "privateAnswer", "requestPayload", "ownerId", "relationCaseId"]) assert.doesNotMatch(JSON.stringify(result), new RegExp(forbidden, "i"));
});

test("all attention surfaces consume the same unresolved relation request projection", () => {
  for (const path of ["app/(connected)/dashboard/page.tsx", "app/(connected)/alertes/page.tsx", "app/(connected)/gouvernance/page.tsx", "app/api/notifications/route.ts"]) {
    assert.match(read(path), /getPendingRelationRequestAttentionForUser/);
  }
  const center = read("components/NotificationCenter.tsx");
  assert.match(center, /PERSISTED_NOTIFICATION/);
  assert.match(center, /RELATION_REQUEST_ATTENTION/);
  const requestBranch = center.slice(center.indexOf('item.kind === "PERSISTED_NOTIFICATION" ? <NotificationLink'));
  assert.match(requestBranch, /router\.push\(item\.href\)/);
  assert.doesNotMatch(requestBranch.slice(requestBranch.indexOf(": <button")), /notificationId|api\/notifications/);
});

test("bell count adds unresolved requests once without persisting or marking them read", async () => {
  const persisted = { kind: "PERSISTED_NOTIFICATION", id: "notification-1", type: "NEW_MESSAGE", relationCaseId: "case-1", title: "Nouveau message", description: "Message", contextLabel: "Lien", href: "/cases/case-1", createdAt: new Date("2026-09-25T09:00:00Z"), readAt: null };
  const pending = { kind: "RELATION_REQUEST_ATTENTION", requestId: "request-1", gLinkId: "link-1", title: "Test1", candidateName: null, createdAt: new Date("2026-09-25T10:00:00Z"), href: "/links/link-1#relation-request-request-1" };
  const route = loadTestModule<any>("app/api/notifications/route.ts", {
    "next/server": { NextResponse: { json: (body: unknown) => Response.json(body) } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner" }) },
    "@/lib/notification-repository": { countUnreadNotificationsForUser: async () => 1 },
    "@/lib/notification-projection": { getNotificationViewsForUser: async () => ({ items: [persisted], hasMore: false }) },
    "@/lib/pending-relation-request-attention": { getPendingRelationRequestAttentionForUser: async () => [pending] },
  });
  const payload = await (await route.GET(new Request("https://goodissima.test/api/notifications?limit=10"))).json();
  assert.equal(payload.unreadCount, 2);
  assert.deepEqual(payload.notifications.map((item: any) => item.kind), ["RELATION_REQUEST_ATTENTION", "PERSISTED_NOTIFICATION"]);
  assert.equal(payload.notifications.filter((item: any) => item.requestId === "request-1").length, 1);
});

test("relations target the exact request and keep decisions explicit", () => {
  const panel = read("components/RelationRequestsPanel.tsx");
  assert.match(panel, /id=\{`relation-request-\$\{request\.id\}`\}/);
  assert.match(panel, /createdAt/);
  assert.match(panel, /attachments/);
  assert.match(panel, /"accept"/);
  assert.match(panel, /"decline"/);
  assert.match(read("lib/pending-relation-request-attention.ts"), /status: "PENDING"/);
  assert.doesNotMatch(read("lib/pending-relation-request-attention.ts"), /relationCase\.(?:create|upsert)|notification\.(?:create|upsert)/);
});

test("legacy active links enter the same pending workflow without materializing a case", () => {
  const casesRoute = read("app/api/cases/route.ts");
  assert.match(casesRoute, /publicCaseCreationRequest\.(?:update|create)/);
  assert.match(casesRoute, /status: "PENDING"/);
  assert.match(casesRoute, /Historical immediate materialization intentionally disabled/);
  const decisions = read("lib/public-relation-request.ts");
  assert.match(decisions, /status: "ACCEPTED", relationCaseId: relationCase\.id/);
  assert.match(decisions, /status: "DECLINED"/);
});
