import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  archivedAnnouncementWhere,
  archivedJourneyWhere,
  archivedOpportunityCount,
} from "../lib/archived-opportunity.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("counts zero, one and several archived opportunity entities", () => {
  assert.equal(archivedOpportunityCount(0, 0), 0);
  assert.equal(archivedOpportunityCount(1, 0), 1);
  assert.equal(archivedOpportunityCount(1, 2), 3);
  assert.equal(archivedOpportunityCount(3, 4), 7);
});

test("only ARCHIVED announcements enter the count", () => {
  const statuses = ["ACTIVE", "DISABLED", "EXPIRED", "ARCHIVED"];
  const archived = statuses.filter((status) => status === archivedAnnouncementWhere("owner-1").status);

  assert.deepEqual(archived, ["ARCHIVED"]);
});

test("archive filters are owner-scoped and preserve the optional template scope", () => {
  assert.deepEqual(archivedAnnouncementWhere("owner-1", "template-1"), {
    ownerId: "owner-1",
    status: "ARCHIVED",
    templateId: "template-1",
  });
  assert.deepEqual(archivedJourneyWhere("owner-1", "template-1"), {
    status: "ARCHIVED",
    OR: [
      { generations: { some: { createdById: "owner-1" } } },
      { links: { some: { ownerId: "owner-1" } } },
    ],
    id: "template-1",
  });
});

test("Dashboard and Opportunities use the same transactional source of truth", () => {
  const repository = source("lib/archived-opportunity-repository.ts");
  const definition = source("lib/archived-opportunity.ts");
  const dashboard = source("app/(connected)/dashboard/page.tsx");
  const opportunities = source("app/(connected)/opportunities/page.tsx");

  assert.match(repository, /prisma\.\$transaction/);
  assert.match(repository, /isolationLevel: "RepeatableRead"/);
  assert.match(repository, /prisma\.gLink\.count/);
  assert.match(repository, /prisma\.relationTemplate\.findMany/);
  assert.match(definition, /status: "ARCHIVED"/);
  assert.match(dashboard, /value: archivedOpportunitySummary\.count/);
  assert.match(opportunities, /const totalArchivedCount = archivedOpportunitySummary\.count/);
  assert.doesNotMatch(dashboard, /links\.filter\(\(item\) => item\.status === "ARCHIVED"\)\.length/);
});

test("unrelated cases, dossiers and link statuses are absent from the archive repository", () => {
  const repository = [
    source("lib/archived-opportunity.ts"),
    source("lib/archived-opportunity-repository.ts"),
  ].join("\n");

  assert.doesNotMatch(repository, /relationCase|dossier|CLOSED|ACTIVE|DISABLED|EXPIRED/);
});
