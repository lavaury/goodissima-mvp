import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (path: string) => readFileSync(path, "utf8");

test("the global notification poll refreshes server surfaces only when unread ids change", () => {
  const center = read("components/NotificationCenter.tsx");
  assert.match(center, /unreadSnapshot\.current === null \? next\.unreadCount > 0 : unreadSnapshot\.current !== nextSnapshot/);
  assert.match(center, /lastObservedUnreadSnapshot = nextSnapshot/);
  assert.match(center, /router\.refresh\(\)/);
  assert.match(center, /setInterval\(\(\) => void load\(\), 45_000\)/);
  assert.doesNotMatch(read("components/DashboardHome.tsx"), /setInterval|\/api\/notifications/);
  assert.doesNotMatch(read("components/SpacesTreeView.tsx"), /setInterval|\/api\/notifications/);
});

test("a successful read updates the bell before navigation and refreshes App Router projections", () => {
  const link = read("components/NotificationLink.tsx");
  assert.match(link, /if \(response\.ok\)[\s\S]*dispatchEvent[\s\S]*finally[\s\S]*router\.push\(href\);[\s\S]*if \(didRead\) router\.refresh\(\)/);
  assert.match(read("components/NotificationCenter.tsx"), /goodissima:notification-read/);
});

test("Home, alerts and space aggregates share unread Notification projections", () => {
  assert.match(read("app/(connected)/dashboard/page.tsx"), /unreadOnly: true/);
  assert.match(read("lib/notification-projection.ts"), /readAt: null/);
  assert.match(read("app/(connected)/gouvernance/page.tsx"), /getUnreadCaseAttentionForUser/);
  assert.match(read("app/(connected)/alertes/page.tsx"), /getNotificationViewsForUser/);
});

test("Home empty state remains conditional on the merged notification and factual list", () => {
  const home = read("components/DashboardHome.tsx");
  const list = read("components/FactualAttentionList.tsx");
  assert.match(home, /mergeAttention|attentionItems|FactualAttentionList/);
  assert.match(list, /if \(!items\.length\).*Rien ne/);
  assert.match(read("lib/unified-attention.ts"), /legacy facts fill the remaining space/);
});

test("case attention counts follow readAt from two to one to zero", async () => {
  let rows = [
    { id: "message", type: "NEW_MESSAGE", relationCaseId: "case", relationCase: { workspaceId: "workspace", candidateName: null, candidateEmail: null } },
    { id: "case-created", type: "NEW_RELATION_CASE", relationCaseId: "case", relationCase: { workspaceId: "workspace", candidateName: null, candidateEmail: null } },
  ];
  const projection = loadTestModule<any>("lib/notification-projection.ts", {
    "@/lib/prisma": { prisma: { notification: { findMany: async (query: any) => { assert.equal(query.where.readAt, null); return rows; } } } },
    "@/lib/candidate-identity": { resolveCandidateIdentityState: () => ({ displayName: "Dossier" }) },
  });
  assert.equal((await projection.getUnreadCaseAttentionForUser("owner"))[0].count, 2);
  rows = rows.slice(1);
  assert.equal((await projection.getUnreadCaseAttentionForUser("owner"))[0].count, 1);
  rows = [];
  assert.deepEqual(await projection.getUnreadCaseAttentionForUser("owner"), []);
});
