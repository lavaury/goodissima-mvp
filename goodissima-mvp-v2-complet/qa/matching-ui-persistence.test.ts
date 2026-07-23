import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const route = source("app/api/links/[linkId]/matching/route.ts");
const panel = source("components/GLinkMatchingPanel.tsx");
const repository = source("lib/matching/matching-repository.ts");
const lifecycle = source("lib/matching/matching-lifecycle-service.ts");

test("GET reads the latest owner-scoped persistent run without executing matching", () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /findSourceForOwner\(owner\.id, params\.linkId\)/);
  assert.match(route, /getLatestMatchingRunWithResultsForGLink/);
  assert.match(route, /run: persisted \? publicDetailedRun\(persisted\.run\) : null/);
  assert.match(route, /results: persisted\?\.results\.map\(publicResult\) \?\? \[\]/);
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function PATCH"));
  assert.doesNotMatch(getBody, /MatchingExecutionService|aIEvent|rankMatches|semanticMatchV2/);
  const publicSerialization = route.slice(
    route.indexOf("function publicRun"),
    route.indexOf("function matchingHttpStatus"),
  );
  assert.doesNotMatch(publicSerialization, /ownerId/);
});

test("latest-run repository read is owner scoped and deterministically ordered", () => {
  assert.match(repository, /findLatestRunWithResultsForGLink\(ownerId: string, gLinkId: string\)/);
  assert.match(repository, /where: \{ ownerId, gLinkId \}/);
  assert.match(repository, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(repository, /results: \{ orderBy: \[\{ internalRank: "asc" \}, \{ createdAt: "asc" \}, \{ id: "asc" \}\] \}/);
  assert.match(lifecycle, /getLatestMatchingRunWithResultsForGLink/);
});

test("panel loads persistence once and never launches an analysis on mount", () => {
  assert.match(panel, /method: "GET"/);
  assert.match(panel, /cache: "no-store"/);
  assert.match(panel, /AbortController/);
  assert.match(panel, /setInitialLoading\(true\)/);
  const effects = [...panel.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map((match) => match[1]).join("\n");
  assert.doesNotMatch(effects, /method: "POST"/);
  assert.match(panel, /MAX_POLL_ATTEMPTS = 5/);
  assert.match(panel, /POLL_INTERVAL_MS = 4000/);
});

test("panel renders every persistent run state honestly", () => {
  for (const wording of [
    "Aucune analyse n’a encore été lancée.",
    "Analyse préparée.",
    "Analyse en cours.",
    "L’analyse n’a pas pu aboutir.",
    "Cette analyse est clôturée.",
    "Analyse suspendue.",
  ]) assert.ok(panel.includes(wording), `missing UI state ${wording}`);
  assert.match(panel, /run\?\.status === "RUNNING"/);
  assert.match(panel, /run\?\.isPaused/);
  assert.match(panel, /disabled=\{launchDisabled\}/);
});

test("persistent explanations are accessible and contain no raw score", () => {
  assert.match(panel, /result\.explanation\.summary/);
  assert.match(panel, /result\.explanation\.signals/);
  assert.match(panel, /result\.explanation\.cautions/);
  assert.match(panel, /<ul/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /role="alert"/);
  assert.doesNotMatch(panel, /internalSimilarity|relationalScore|scoreBreakdown/);
});

test("each human launch gets a bounded random idempotency key and prevents duplicate POST", () => {
  assert.match(panel, /crypto\.randomUUID/);
  assert.match(panel, /crypto\.getRandomValues/);
  assert.match(panel, /"Idempotency-Key": key/);
  assert.match(panel, /if \(loading \|\| run\?\.status === "RUNNING"\) return/);
  assert.match(panel, /attemptKey\.current \?\? createAttemptKey\(\)/);
  assert.match(panel, /La connexion a été interrompue\. Réessayez pour reprendre la même tentative\./);
});

test("legacy decisions are restricted to persistent target GLinks", () => {
  assert.match(panel, /decide\(result\.targetGLinkId/);
  assert.doesNotMatch(panel, /nextStatus:\s*"SELECTED"|matchingResult\.update/);
  assert.doesNotMatch(panel, /relationCase|createCase|linkCase/);
  assert.match(route, /matchingResult\.findFirst/);
});

test("reactivation restores persistence without launching an analysis", () => {
  const changeEnabled = panel.slice(panel.indexOf("async function changeEnabled"), panel.indexOf("async function analyze"));
  assert.match(changeEnabled, /setEnabled\(nextEnabled\)/);
  assert.match(changeEnabled, /await readPersistentState\(\)/);
  assert.match(changeEnabled, /Le matching est activé, mais son dernier état n’a pas pu être rechargé\./);
  assert.doesNotMatch(changeEnabled, /method: "POST"|MatchingExecutionService|analyze\(\)/);
});

test("setting mutation handles network errors and blocks duplicate PATCH requests", () => {
  const changeEnabled = panel.slice(panel.indexOf("async function changeEnabled"), panel.indexOf("async function analyze"));
  assert.match(panel, /const \[updatingEnabled, setUpdatingEnabled\] = useState\(false\)/);
  assert.match(changeEnabled, /if \(enabledMutationPending\.current\) return/);
  assert.match(changeEnabled, /try \{/);
  assert.match(changeEnabled, /catch \{/);
  assert.match(changeEnabled, /finally \{/);
  assert.match(changeEnabled, /Impossible de modifier le matching\. Vérifiez votre connexion et réessayez\./);
  assert.match(panel, /disabled=\{updatingEnabled\}/);
});

test("legacy decision mutation handles network errors and blocks duplicate clicks", () => {
  const decide = panel.slice(panel.indexOf("async function decide"), panel.indexOf("const boussoleState"));
  assert.match(decide, /if \(decisionPending\.current\.has\(targetGLinkId\)\) return/);
  assert.match(decide, /try \{/);
  assert.match(decide, /catch \{/);
  assert.match(decide, /finally \{/);
  assert.match(decide, /Impossible d’enregistrer la décision\. Vérifiez votre connexion et réessayez\./);
  assert.match(panel, /disabled=\{decidingTargets\[result\.targetGLinkId\]\}/);
  assert.ok(decide.indexOf("setDecisions") > decide.indexOf("if (!response.ok)"));
});

test("modified UI and API files contain no common UTF-8 corruption marker", () => {
  const markers = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\u00ef\u00bf\u00bd"];
  for (const path of [
    "components/GLinkMatchingPanel.tsx",
    "app/api/links/[linkId]/matching/route.ts",
  ]) {
    const content = source(path);
    for (const marker of markers) assert.equal(content.includes(marker), false, `${path}: corrupt UTF-8`);
  }
});

test("lot four adds no automatic business consequence", () => {
  const combined = `${route}\n${panel}`;
  assert.doesNotMatch(combined, /sendEmail|sendMail|notification|invitation|candidateAccessToken|relationCase\.create|matchingResult\.update/i);
  assert.doesNotMatch(combined, /\/pause|\/resume|\/close/);
});
