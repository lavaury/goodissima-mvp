import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDashboardLinkCounts } from "../lib/dashboard-link-counts.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function relationCase(status: string, actionStatuses: string[] = []) {
  return { status, relationActions: actionStatuses.map((actionStatus) => ({ status: actionStatus })) };
}

test("counts zero, one and two received requests from the same dossiers", () => {
  assert.deepEqual(getDashboardLinkCounts([]), {
    dossierCount: 0,
    receivedRequestCount: 0,
    pendingActionCount: 0,
  });
  assert.equal(getDashboardLinkCounts([relationCase("NEW")]).receivedRequestCount, 1);
  assert.equal(getDashboardLinkCounts([relationCase("NEW"), relationCase("REVIEWING")]).receivedRequestCount, 2);
});

test("distinguishes received requests from pending actions", () => {
  const counts = getDashboardLinkCounts([
    relationCase("NEW", ["PENDING"]),
    relationCase("REVIEWING", ["COMPLETED"]),
  ]);

  assert.equal(counts.dossierCount, 2);
  assert.equal(counts.receivedRequestCount, 2);
  assert.equal(counts.pendingActionCount, 1);
});

test("closed and archived dossiers remain received requests while only open actions are counted", () => {
  const counts = getDashboardLinkCounts([
    relationCase("CLOSED", ["PENDING", "COMPLETED"]),
    relationCase("ARCHIVED", ["PENDING"]),
  ]);

  assert.equal(counts.dossierCount, 2);
  assert.equal(counts.receivedRequestCount, 2);
  assert.equal(counts.pendingActionCount, 2);
});

test("counts each owner-scoped link independently without deduplication across links", () => {
  const firstLink = getDashboardLinkCounts([
    relationCase("NEW", ["PENDING"]),
    relationCase("NEW"),
  ]);
  const secondLink = getDashboardLinkCounts([
    relationCase("NEW", ["PENDING"]),
    relationCase("NEW", ["PENDING"]),
  ]);

  assert.equal(firstLink.receivedRequestCount, 2);
  assert.equal(secondLink.receivedRequestCount, 2);
  assert.equal(firstLink.pendingActionCount, 1);
  assert.equal(secondLink.pendingActionCount, 2);
});

test("LinkCard uses one count for the request badge and dossier button", () => {
  const dashboard = source("app/(connected)/dashboard/page.tsx");
  const card = source("components/LinkCard.tsx");

  assert.match(dashboard, /getDashboardLinkCounts\(item\.cases\)/);
  assert.match(dashboard, /receivedRequestCount: linkCounts\.receivedRequestCount/);
  assert.match(card, /const caseCount = item\.receivedRequestCount \?\? item\.cases\?\.length \?\? 0/);
  assert.match(card, /\{caseCount\} demande/);
  assert.match(card, /Voir les \{caseCount\} dossiers/);
  assert.match(card, /\{item\.openActionCount\} action/);
  assert.doesNotMatch(card, /\{item\.openActionCount\} demande/);
});

test("Dashboard source remains owner-scoped and performs no per-card query", () => {
  const dashboard = source("app/(connected)/dashboard/page.tsx");

  assert.match(dashboard, /prisma\.gLink\.findMany\(\{[\s\S]*?where: \{ ownerId: owner\.id \}/);
  assert.doesNotMatch(source("components/LinkCard.tsx"), /prisma|fetch\([^\n]*count/i);
});
