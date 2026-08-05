import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("R0 freezes GJ as an internal extension until an explicit R1/R2/R3 revision", async () => {
  const [workspace, casePage, listRoute, detailRoute, creationAction, cockpit] = await Promise.all([
    read("../components/RelationCaseWorkspace.tsx"),
    read("../app/cases/[caseId]/page.tsx"),
    read("../app/cases/[caseId]/journeys/page.tsx"),
    read("../app/cases/[caseId]/journeys/[journeyId]/page.tsx"),
    read("../lib/governance-journey-actions.ts"),
    read("../app/gouvernance/parcours/[id]/pilotage/page.tsx"),
  ]);

  assert.doesNotMatch(workspace, /Parcours gouvernés|GovernedJourneyCards|\/cases\/\$\{[^}]+\}\/journeys/);
  assert.doesNotMatch(casePage, /governedJourneyReadService|governedJourneys|\/journeys/);

  const immediateNotFound = /^import \{ notFound \} from "next\/navigation";\s+export default function \w+\(\) \{\s+notFound\(\);\s+\}\s*$/;
  for (const route of [listRoute, detailRoute]) {
    assert.match(route, immediateNotFound);
    assert.doesNotMatch(route, /redirect\s*\(|gouvernance\/parcours|governedJourneyReadService|<main|<Link|demo|fixture|mock/i);
  }

  assert.match(creationAction, /export async function createGovernedJourneyAction/);
  assert.match(creationAction, /tx\.relationTemplate\.create/);
  assert.match(creationAction, /tx\.formTemplate\.create/);
  assert.match(creationAction, /tx\.templateVersion\.create/);
  assert.doesNotMatch(creationAction, /(?:tx|prisma)\.governedJourney\.create|createGovernedJourney\s*\(/);

  assert.match(cockpit, /prisma\.formTemplate\.findUnique\(\{\s+where: \{ id: params\.id \}/);
  assert.match(cockpit, /formTemplate\.relationTemplate/);
  assert.doesNotMatch(cockpit, /from "@\/lib\/governed-journey\/(?:service|lifecycle)"|(?:activate|suspend|resume|close|cancel)GovernedJourney\s*\(/);

  const automaticReconciliationSurface = `${creationAction}\n${cockpit}`;
  assert.doesNotMatch(automaticReconciliationSurface, /governedJourney.*(?:backfill|synchroni[sz]e)|(?:backfill|synchroni[sz]e).*governedJourney/i);
});
