import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GJ-4 remains architecturally frozen without case-scoped user exposure", async () => {
  const [workspace, casePage, listRoute, detailRoute] = await Promise.all([
    readFile(new URL("../components/RelationCaseWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cases/[caseId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cases/[caseId]/journeys/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cases/[caseId]/journeys/[journeyId]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(workspace, /GovernedJourneyCards|\/journeys/);
  assert.doesNotMatch(casePage, /governedJourneyReadService|governedJourneys/);

  for (const route of [listRoute, detailRoute]) {
    assert.match(route, /^import \{ notFound \} from "next\/navigation";\s+export default function \w+\(\) \{\s+notFound\(\);\s+\}\s*$/);
    assert.doesNotMatch(route, /GovernedJourneyCards|GovernedJourneyDetailView|governedJourneyReadService|redirect\s*\(|gouvernance\/parcours|<main|<Link/);
  }
});
