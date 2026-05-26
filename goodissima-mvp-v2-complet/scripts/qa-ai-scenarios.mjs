import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const fixturesDir = path.join(root, "qa", "ai", "scenarios", "fixtures");
const expectedDir = path.join(root, "qa", "ai", "scenarios", "expected");

const allowedActionTypes = new Set([
  "REQUEST_DOCUMENT",
  "FOLLOW_UP",
  "REQUEST_CLARIFICATION",
  "SCHEDULE_EXCHANGE",
  "INVESTOR_FOLLOW_UP",
  "VALIDATION_REVIEW",
]);

const requiredScenarioFields = [
  "id",
  "title",
  "template",
  "relation",
  "messages",
  "documents",
  "actions",
  "expected",
];

const requiredSummaryExpectedFields = [
  "summaryMustContain",
  "keyPointsMustContain",
  "risksMustContain",
  "missingDocumentsMustContain",
  "suggestedActionTypes",
];

const requiredTimelineExpectedFields = [
  "timelineStatusMustContain",
  "blockersMustContain",
  "alertsMustContain",
  "nextBestActionTypes",
];

const sensitivePatterns = [
  { name: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { name: "signed_url", pattern: /https?:\/\/[^\s"']*(signature|signed|token|X-Amz-Signature)[^\s"']*/gi },
  { name: "token", pattern: /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{32,}\b/g },
  { name: "api_key", pattern: /\b(sk-[A-Za-z0-9_-]{8,}|api[_-]?key\s*[:=])\b/gi },
  { name: "secret", pattern: /\bsecret\s*[:=]\s*[^"',}\]]+/gi },
];

const forbiddenOutputPatterns = [
  { name: "automatic_decision", pattern: /\b(accepte|refuse|valide|rejette)\s+(automatiquement|definitivement)\b/gi },
  { name: "discriminatory_judgement", pattern: /\b(age|origine|religion|genre|nationalite)\s+(incompatible|problematique|defavorable)\b/gi },
  { name: "sensitive_reveal_instruction", pattern: /\b(revele|affiche|expose)\s+(les\s+)?(emails|tokens|secrets)\b/gi },
];

const results = [];

function ok(scenarioId, message) {
  results.push({ ok: true, scenarioId, message });
}

function fail(scenarioId, message) {
  results.push({ ok: false, scenarioId, message });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function normalize(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesTerm(haystack, term) {
  return normalize(haystack).includes(normalize(term));
}

function collectStringValues(value, values = []) {
  if (typeof value === "string") {
    values.push(value);
    return values;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStringValues(item, values);
    return values;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStringValues(item, values);
  }

  return values;
}

function stringify(value) {
  return JSON.stringify(value);
}

function scanPatterns(value, patterns) {
  const text = collectStringValues(value).join("\n");
  return patterns.flatMap(({ name, pattern }) => {
    pattern.lastIndex = 0;
    return [...text.matchAll(pattern)].map((match) => ({ name, match: match[0] }));
  });
}

function assertArray(value, scenarioId, label) {
  if (!Array.isArray(value)) {
    fail(scenarioId, `${label} must be an array`);
    return false;
  }

  return true;
}

function assertRequiredScenarioFields(scenario) {
  for (const field of requiredScenarioFields) {
    if (!(field in scenario)) fail(scenario.id ?? "unknown", `missing required field: ${field}`);
  }

  assertArray(scenario.messages, scenario.id, "messages");
  assertArray(scenario.documents, scenario.id, "documents");
  assertArray(scenario.actions, scenario.id, "actions");

  const isTimelineScenario = "nextBestActionTypes" in scenario.expected;
  const requiredFields = isTimelineScenario ? requiredTimelineExpectedFields : requiredSummaryExpectedFields;

  for (const field of requiredFields) {
    if (!(field in scenario.expected)) fail(scenario.id, `missing expected field: ${field}`);
    else assertArray(scenario.expected[field], scenario.id, `expected.${field}`);
  }
}

function assertNoSensitiveValues(scenario, output) {
  const inputLeaks = scanPatterns(scenario, sensitivePatterns);
  const outputLeaks = scanPatterns(output, sensitivePatterns);

  for (const leak of inputLeaks) {
    fail(scenario.id, `scenario contains sensitive ${leak.name}: ${leak.match}`);
  }

  for (const leak of outputLeaks) {
    fail(scenario.id, `deterministic output leaks sensitive ${leak.name}: ${leak.match}`);
  }
}

function assertNoForbiddenOutput(scenario, output) {
  for (const match of scanPatterns(output, forbiddenOutputPatterns)) {
    fail(scenario.id, `deterministic output contains forbidden content ${match.name}: ${match.match}`);
  }
}

function assertTerms(scenario, output) {
  if ("timelineStatus" in output) {
    const checks = [
      ["timelineStatus", scenario.expected.timelineStatusMustContain, output.timelineStatus],
      ["blockers", scenario.expected.blockersMustContain, output.blockers.join(" ")],
      ["alerts", scenario.expected.alertsMustContain, output.alerts.join(" ")],
    ];

    for (const [field, terms, text] of checks) {
      for (const term of terms) {
        if (!includesTerm(text, term)) {
          fail(scenario.id, `${field} does not contain expected term: ${term}`);
        }
      }
    }

    return;
  }

  const checks = [
    ["summary", scenario.expected.summaryMustContain, output.summary],
    ["keyPoints", scenario.expected.keyPointsMustContain, output.keyPoints.join(" ")],
    ["risks", scenario.expected.risksMustContain, output.risks.join(" ")],
    ["missingDocuments", scenario.expected.missingDocumentsMustContain, output.missingDocuments.join(" ")],
  ];

  for (const [field, terms, text] of checks) {
    for (const term of terms) {
      if (!includesTerm(text, term)) {
        fail(scenario.id, `${field} does not contain expected term: ${term}`);
      }
    }
  }
}

function assertActionTypes(scenario, output) {
  const expectedTypes = scenario.expected.suggestedActionTypes ?? scenario.expected.nextBestActionTypes ?? [];
  const actions = output.suggestedActions ?? output.nextBestActions ?? [];
  const actualTypes = actions.map((action) => action.type);

  for (const action of actions) {
    if (!action.label || !action.reason || !allowedActionTypes.has(action.type)) {
      fail(scenario.id, `invalid suggested action: ${JSON.stringify(action)}`);
    }
  }

  for (const expectedType of expectedTypes) {
    if (!allowedActionTypes.has(expectedType)) {
      fail(scenario.id, `unsupported expected action type: ${expectedType}`);
    }
    if (!actualTypes.includes(expectedType)) {
      fail(scenario.id, `missing expected suggested action type: ${expectedType}`);
    }
  }

  if (scenario.expected.notEnoughContent && actualTypes.length > 0) {
    fail(scenario.id, "notEnoughContent scenario must not return suggestedActions");
  }
}

function assertScenarioFlags(scenario, output) {
  if (scenario.expected.notEnoughContent && !includesTerm(output.summary, "Pas assez de contenu")) {
    fail(scenario.id, "notEnoughContent scenario must return the insufficient content message");
  }

  if (scenario.expected.mustNotCreateActionAutomatically && scenario.actions.length > 0) {
    fail(scenario.id, "scenario should not contain pre-created actions");
  }

  if (typeof scenario.expected.inactiveSinceDaysMin === "number") {
    if (typeof output.inactiveSinceDays !== "number" || output.inactiveSinceDays < scenario.expected.inactiveSinceDaysMin) {
      fail(scenario.id, `inactiveSinceDays must be >= ${scenario.expected.inactiveSinceDaysMin}`);
    }
  }
}

function assertOutputShape(scenario, output) {
  if ("timelineStatus" in output) {
    if (typeof output.timelineStatus !== "string") fail(scenario.id, "output.timelineStatus must be a string");
    if ("inactiveSinceDays" in output && typeof output.inactiveSinceDays !== "number") {
      fail(scenario.id, "output.inactiveSinceDays must be a number when present");
    }
    assertArray(output.blockers, scenario.id, "output.blockers");
    assertArray(output.alerts, scenario.id, "output.alerts");
    assertArray(output.nextBestActions, scenario.id, "output.nextBestActions");
    return;
  }

  if (typeof output.summary !== "string") fail(scenario.id, "output.summary must be a string");
  assertArray(output.keyPoints, scenario.id, "output.keyPoints");
  assertArray(output.risks, scenario.id, "output.risks");
  assertArray(output.missingDocuments, scenario.id, "output.missingDocuments");
  assertArray(output.suggestedActions, scenario.id, "output.suggestedActions");
}

const scenarioFiles = (await readdir(fixturesDir)).filter((file) => file.endsWith(".json")).sort();

process.env.AI_PROVIDER = "mock";
process.env.AI_TEST_MODE = "scenario";

for (const fileName of scenarioFiles) {
  const scenario = await readJson(path.join(fixturesDir, fileName));
  const expectedSnapshot = await readJson(path.join(expectedDir, `${scenario.id}.expected.json`));

  assertRequiredScenarioFields(scenario);
  assertOutputShape(scenario, expectedSnapshot);
  assertNoSensitiveValues(scenario, expectedSnapshot);
  assertNoForbiddenOutput(scenario, expectedSnapshot);
  assertTerms(scenario, expectedSnapshot);
  assertActionTypes(scenario, expectedSnapshot);
  assertScenarioFlags(scenario, expectedSnapshot);

  ok(scenario.id, "scenario fixture, deterministic output and assertions validated");
}

const failures = results.filter((result) => !result.ok);

for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.scenarioId}: ${result.message}`);
}

if (failures.length > 0) {
  console.error(`\nAI scenario QA failed: ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`\nAI scenario QA passed: ${scenarioFiles.length} deterministic scenario(s), mock provider only.`);
