import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (file: string) => readFileSync(file, "utf8");

test("UI projection is owner-scoped, bounded, human and recursively privacy-safe", async () => {
  const calls: any[] = [];
  const prisma = { notification: { findMany: async (query: any) => { calls.push(query); return [{
    id: "n1", type: "NEW_RELATION_CASE", relationCaseId: "case-1", createdAt: new Date("2026-09-13T12:00:00Z"), readAt: null,
    relationCase: { gLink: { title: "Recherche de baby-sitter à Beauvais" } },
  }, {
    id: "n2", type: "NEW_MESSAGE", relationCaseId: "case-1", createdAt: new Date("2026-09-13T13:00:00Z"), readAt: null,
    relationCase: { gLink: { title: "Recherche de baby-sitter à Beauvais" } },
  }]; } } };
  const projection = loadTestModule<any>("lib/notification-projection.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/candidate-identity": { resolveCandidateIdentityState: () => ({ displayName: "Candidat non identifié" }) },
  });
  const result = await projection.getNotificationViewsForUser("alice", { limit: 999, page: 0, unreadOnly: true });
  assert.deepEqual(result.items.map((item: any) => item.title), ["Nouvel échange", "Nouveau message"]);
  assert.equal(calls[0].take, 21);
  assert.deepEqual(calls[0].where, { recipientUserId: "alice", relationCase: { ownerId: "alice" }, readAt: null });
  const serialized = JSON.stringify(result);
  for (const forbidden of ["candidateAccessToken", "email", "phone", "address", "alias", "workspaceId", "ownerId", "matching", "trust", "identity", "body", "excerpt"]) assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
});

test("Home prioritizes unread notifications, preserves legacy facts and deduplicates a Dossier", () => {
  const merge = loadTestModule<any>("lib/unified-attention.ts", {});
  const notification = (id: string, relationCaseId: string, type = "NEW_RELATION_CASE") => ({ id, relationCaseId, type, title: type === "NEW_MESSAGE" ? "Nouveau message" : "Nouvel échange", description: "Attention", contextLabel: "Baby-sitter", href: `/cases/${relationCaseId}`, createdAt: new Date(), readAt: null });
  const fact = (id: string) => ({ id, type: "WAITING_OWNER", object: "Dossier", label: id, reason: "Legacy", href: `/cases/${id}` });
  const items = merge.mergeAttention([notification("n1", "c1"), notification("n2", "c2", "NEW_MESSAGE")], [fact("c1"), fact("c3")], 3);
  assert.deepEqual(items.map((item: any) => item.relationCaseId), ["c1", "c2", "c3"]);
  assert.equal(items[0].notificationId, "n1"); assert.equal(items[2].notificationId, undefined);
});

function renderCenter(unreadCount: number) {
  let stateCall = 0;
  const react = { ...React,
    useState: (initial: any) => [stateCall++ === 0 ? { notifications: [], unreadCount } : false, () => {}],
    useRef: (value: any) => ({ current: value }), useEffect: () => {},
  };
  const center = loadTestModule<any>("components/NotificationCenter.tsx", {
    react, "react/jsx-runtime": jsx,
    "@/components/NotificationLink": { NotificationLink: ({ children }: any) => jsx.jsx("button", { children }) },
  });
  return renderToStaticMarkup(jsx.jsx(center.NotificationCenter, {}));
}

test("global bell has accessible zero, one and capped multiple states", () => {
  assert.match(renderCenter(0), /Notifications, aucune non lue/);
  assert.match(renderCenter(1), /Notifications, 1 non lue/);
  const many = renderCenter(12);
  assert.match(many, />9\+</); assert.match(many, /12 non lues/);
  const source = read("components/NotificationCenter.tsx");
  assert.match(source, /45_000/); assert.match(source, /limit=10/); assert.match(source, /slice\(0, 10\)/);
  assert.match(source, /event\.key === "Escape"/); assert.match(source, /motion-safe:animate-bounce/);
  assert.doesNotMatch(source.slice(source.indexOf("<summary"), source.indexOf("</summary>")), /PATCH|read: true/);
});

test("notification activation patches only that item then navigates, even if PATCH fails", async () => {
  const calls: any[] = [], destinations: string[] = [];
  let ok = true;
  const module = loadTestModule<any>("components/NotificationLink.tsx", {
    "react/jsx-runtime": jsx,
    "next/navigation": { useRouter: () => ({ push: (href: string) => destinations.push(href) }) },
  }, { fetch: async (...args: any[]) => { calls.push(args); return { ok }; } });
  const element = module.NotificationLink({ notificationId: "n1", href: "/cases/c1", children: "Ouvrir" });
  element.props.onClick(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(calls[0][0], /\/api\/notifications\/n1$/); assert.match(calls[0][1].body, /"read":true/); assert.deepEqual(destinations, ["/cases/c1"]);
  ok = false; element.props.onClick(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(destinations, ["/cases/c1", "/cases/c1"]);
});

test("Mes espaces aggregates assigned, unassigned and collapsed attention without schema changes", async () => {
  const spaces = loadTestModule<any>("lib/spaces-repository.ts", { "@/lib/prisma": { prisma: {
    portfolio: { findMany: async () => [{ id: "p", name: "Famille", status: "ACTIVE" }] },
    workspace: { findMany: async () => [{ id: "w", name: "Baby-sitter", status: "ACTIVE", portfolioId: "p", _count: { relationTemplates: 0, links: 1, relationCases: 1 } }] },
  } } });
  const attention = [{ relationCaseId: "c1", workspaceId: "w", caseLabel: "Candidat non identifié", count: 2, newestNotificationId: "n2", newestType: "NEW_MESSAGE" }];
  const tree = await spaces.getSpacesTree("alice", attention);
  assert.equal(tree.portfolios[0].unreadCount, 2);
  assert.equal(tree.portfolios[0].workspaces[0].unreadAttention[0].relationCaseId, "c1");
  for (const file of ["components/SpacesTreeView.tsx", "components/WorkspaceRow.tsx", "components/SpacesExistingAttachments.tsx"]) assert.match(read(file), /Attention/);
  assert.match(read("components/SpacesExistingAttachments.tsx"), /workspaceId === null|unreadAttention/);
  assert.doesNotMatch(read("prisma/schema.prisma"), /NOTIF-UX-01/);
});

test("mobile surfaces remain viewport-bounded and do not use permanent blinking", () => {
  const center = read("components/NotificationCenter.tsx");
  assert.match(center, /w-\[min\(22rem,calc\(100vw-1rem\)\)\]/);
  assert.match(center, /max-h-\[min\(70dvh,32rem\)\]/);
  assert.doesNotMatch(center, /animate-ping|animate-pulse|blink/);
  assert.match(read("components/AttentionBadge.tsx"), /min-h-7|shrink-0/);
});
