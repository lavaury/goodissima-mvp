import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const route = source("app/api/links/[linkId]/matching/route.ts");
const panel = source("components/GLinkMatchingPanel.tsx");
const repository = source("lib/matching/matching-repository.ts");
const lifecycle = source("lib/matching/matching-lifecycle-service.ts");
const linkPage = source("app/(connected)/links/[linkId]/page.tsx");

test("GET reads the latest owner-scoped persistent run without executing matching", () => {
  assert.match(route, /export async function GET/);
  assert.match(route, /findSourceForOwner\(owner\.id, linkId\)/);
  assert.match(route, /getLatestMatchingRunWithResultsForGLink/);
  assert.match(route, /results: persisted\?\.results\.map\(publicResult\) \?\? \[\]/);
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function PATCH"));
  assert.doesNotMatch(getBody, /MatchingExecutionService|aIEvent|rankMatches|semanticMatchV2/);
  const serialization = route.slice(route.indexOf("function publicRun"), route.indexOf("function matchingHttpStatus"));
  assert.doesNotMatch(serialization, /ownerId/);
  assert.match(serialization, /selectedAt: result\.selectedAt\?\.toISOString\(\) \?\? null/);
  assert.match(serialization, /dismissedAt: result\.dismissedAt\?\.toISOString\(\) \?\? null/);
});

test("GET returns a serializable empty state and masks technical failures", () => {
  const getBody = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function PATCH"));
  assert.match(getBody, /run: persisted \? publicDetailedRun\(persisted\.run\) : null/);
  assert.match(getBody, /results: persisted\?\.results\.map\(publicResult\) \?\? \[\]/);
  assert.match(getBody, /return NextResponse\.json\(\{ error: "MATCHING_READ_FAILED" \}, \{ status: 500 \}\)/);
  assert.doesNotMatch(getBody, /error\.stack|PrismaClient|P20\d\d/);
});

test("POST serializes complete run dates without the obsolete legacy matches payload", () => {
  const postBody = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function GET"));
  const serialization = route.slice(route.indexOf("function publicRun"), route.indexOf("function matchingHttpStatus"));
  assert.match(postBody, /run: publicRun\(response\.run\)/);
  assert.match(postBody, /results: response\.results\.map\(publicResult\)/);
  assert.doesNotMatch(postBody, /matches:|legacyMatch/);
  assert.match(postBody, /warnings: \[\]/);
  assert.match(serialization, /startedAt: run\.startedAt\?\.toISOString\(\) \?\? null/);
  assert.match(serialization, /completedAt: run\.completedAt\?\.toISOString\(\) \?\? null/);
  assert.match(serialization, /selectedAt: result\.selectedAt\?\.toISOString\(\) \?\? null/);
  assert.match(serialization, /dismissedAt: result\.dismissedAt\?\.toISOString\(\) \?\? null/);
});

test("UI accepts a successful empty GET payload without reporting a false error", () => {
  const applyPayload = panel.slice(panel.indexOf("const applyPayload"), panel.indexOf("const readPersistentState"));
  const readState = panel.slice(panel.indexOf("const readPersistentState"), panel.indexOf("useEffect", panel.indexOf("const readPersistentState")));
  assert.match(panel, /run: MatchingRunView \| null/);
  assert.match(applyPayload, /setRun\(payload\.run\)/);
  assert.match(applyPayload, /setResults\(payload\.results\)/);
  assert.match(applyPayload, /setErrorMessage\(null\)/);
  assert.match(readState, /if \(!response\.ok\) throw/);
  assert.match(readState, /applyPayload\(payload\)/);
  assert.doesNotMatch(readState, /if \(!payload\.run\)|throw new Error\([^)]*run/i);
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
  const effects = [...panel.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map((match) => match[1]).join("\n");
  assert.doesNotMatch(effects, /method: "POST"/);
  assert.match(panel, /MAX_POLL_ATTEMPTS = 5/);
});

test("panel renders every persistent run state honestly", () => {
  for (const status of ["PREPARED", "RUNNING", "FAILED", "CLOSED"]) assert.ok(panel.includes(`run.status === "${status}"`));
  assert.match(panel, /run\?\.isPaused/);
  assert.match(panel, /disabled=\{launchDisabled\}/);
});

test("persistent explanations remain accessible without raw scores", () => {
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
});

test("PATCH persists an owner-scoped decision through the lifecycle service", () => {
  const patch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("async function readIdempotencyKey"));
  assert.match(patch, /linkSource\(linkId, owner\.id\)/);
  assert.match(patch, /body\?\.decision === "SELECTED" \|\| body\?\.decision === "DISMISSED"/);
  assert.match(patch, /getMatchingRunForOwner\(\{ ownerId: owner\.id, runId \}\)/);
  assert.match(patch, /decisionRun\.gLinkId !== source\.id/);
  assert.match(patch, /transitionMatchingResult\(\{/);
  assert.match(patch, /ownerId: owner\.id[^]*runId[^]*resultId[^]*nextStatus: decision/);
  assert.match(patch, /NextResponse\.json\(\{ result: publicResult\(result\) \}\)/);
  assert.doesNotMatch(patch, /aIEvent|AIEvent|INTERESTING|IGNORED|glink_matching_interested|glink_matching_ignored/);
});

test("PATCH discriminates explicit lifecycle actions and returns public run state", () => {
  const patch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("async function readIdempotencyKey"));
  assert.match(patch, /body\?\.action === "SUSPEND"[^]*body\?\.action === "RESUME"[^]*body\?\.action === "CLOSE"/);
  assert.match(patch, /isLifecyclePayload/);
  assert.match(patch, /isDecisionPayload/);
  assert.match(patch, /transitionMatchingRunLifecycle\(\{/);
  assert.match(patch, /gLinkId: source\.id/);
  assert.match(patch, /run: publicDetailedRun\(run\)/);
  assert.match(route, /pausedAt: run\.pausedAt\?\.toISOString\(\) \?\? null/);
  assert.match(route, /closedAt: run\.closedAt\?\.toISOString\(\) \?\? null/);
  assert.match(route, /allowedActions: allowedMatchingRunActions\(run\)/);
});

test("UI exposes lifecycle controls, confirms closure and resynchronizes conflicts", () => {
  const lifecycleMutation = panel.slice(panel.indexOf("async function changeRunLifecycle"), panel.indexOf("const boussoleState"));
  assert.match(panel, /Suspendre/);
  assert.match(panel, /Reprendre/);
  assert.match(panel, /Clôturer/);
  assert.match(lifecycleMutation, /window\.confirm/);
  assert.match(lifecycleMutation, /JSON\.stringify\(\{ runId: run\.id, action \}\)/);
  assert.match(lifecycleMutation, /response\.status === 409[^]*await readPersistentState\(\)/);
  assert.doesNotMatch(lifecycleMutation, /method: "POST"|analyze\(\)/);
  assert.match(panel, /\["RESULTS_AVAILABLE", "CLOSED"\]\.includes\(run\.status\)/);
  assert.match(panel, /run\.isPaused \|\| run\.status === "CLOSED"/);
  assert.match(panel, /results\.map/);
});

test("persistent decision mutation resynchronizes conflicts and blocks duplicate clicks", () => {
  const decide = panel.slice(panel.indexOf("async function decide"), panel.indexOf("const boussoleState"));
  assert.match(decide, /if \(!run \|\| decisionPending\.current\.has\(resultId\)\) return/);
  assert.match(decide, /JSON\.stringify\(\{ runId: run\.id, resultId, decision \}\)/);
  assert.match(decide, /response\.status === 409[^]*await readPersistentState\(\)/);
  assert.match(decide, /setResults\(\(current\) => current\.map/);
  assert.match(decide, /finally \{/);
  assert.match(panel, /disabled=\{decidingResults\[result\.id\] \|\| run\.isPaused \|\| run\.status === "CLOSED"\}/);
});

test("reactivation restores persistence without launching an analysis", () => {
  const changeEnabled = panel.slice(panel.indexOf("async function changeEnabled"), panel.indexOf("async function analyze"));
  assert.match(changeEnabled, /setEnabled\(nextEnabled\)/);
  assert.match(changeEnabled, /await readPersistentState\(\)/);
  assert.doesNotMatch(changeEnabled, /method: "POST"|MatchingExecutionService|analyze\(\)/);
});

test("setting mutation handles network errors and blocks duplicate PATCH requests", () => {
  const changeEnabled = panel.slice(panel.indexOf("async function changeEnabled"), panel.indexOf("async function analyze"));
  assert.match(panel, /const \[updatingEnabled, setUpdatingEnabled\] = useState\(false\)/);
  assert.match(changeEnabled, /if \(enabledMutationPending\.current\) return/);
  assert.match(changeEnabled, /try \{/);
  assert.match(changeEnabled, /catch \{/);
  assert.match(changeEnabled, /finally \{/);
  assert.match(panel, /disabled=\{updatingEnabled\}/);
});

test("UI renders persistent decisions and keeps dismissed results modifiable", () => {
  assert.match(panel, /results\.map\(\(result\) =>/);
  assert.doesNotMatch(panel, /results\.filter/);
  assert.match(panel, /result\.status === "SELECTED"[^]*Retenu/);
  assert.match(panel, /result\.status === "DISMISSED"[^]*Écarté/);
  assert.match(panel, /decide\(result\.id, "SELECTED"\)/);
  assert.match(panel, /decide\(result\.id, "DISMISSED"\)/);
  assert.match(panel, /aria-pressed=\{result\.status === "SELECTED"\}/);
  assert.match(panel, /aria-pressed=\{result\.status === "DISMISSED"\}/);
  assert.doesNotMatch(panel, /INTERESTING|IGNORED|setDecisions/);
});

test("removes only the unused legacy initial analysis props from the link page", () => {
  assert.doesNotMatch(panel + linkPage, /initialMatches|initialAnalyzed/);
  assert.doesNotMatch(linkPage, /latestGLinkEvents|latestGLinkAnalysis|parseGLinkMatchingAnalysis/);
});

test("decision failures expose only stable public errors", () => {
  const patch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("async function readIdempotencyKey"));
  assert.match(patch, /MATCHING_DECISION_INVALID/);
  assert.match(patch, /MATCHING_DECISION_FAILED/);
  assert.match(patch, /MATCHING_LIFECYCLE_INVALID/);
  assert.match(patch, /MATCHING_LIFECYCLE_FAILED/);
  assert.match(patch, /error instanceof MatchingDomainError/);
  assert.doesNotMatch(patch, /error\.stack|PrismaClient|P20\d\d/);
});

test("human decisions add no automatic business consequence", () => {
  const combined = `${route}\n${panel}\n${lifecycle}`;
  assert.doesNotMatch(combined, /sendEmail|sendMail|notification|invitation|candidateAccessToken|relationCase\.(?:create|update)|matchingResult\.update/i);
  assert.doesNotMatch(combined, /nextStatus:\s*"LINKED"/);
  assert.doesNotMatch(combined, /\/pause|\/resume|\/close/);
});

test("modified UI and API files contain no common UTF-8 corruption marker", () => {
  const markers = ["\u00c3", "\u00c2", "\u00e2\u20ac", "\u00ef\u00bf\u00bd"];
  for (const path of ["components/GLinkMatchingPanel.tsx", "app/api/links/[linkId]/matching/route.ts"]) {
    const content = source(path);
    for (const marker of markers) assert.equal(content.includes(marker), false, `${path}: corrupt UTF-8`);
  }
});
