import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const qaRoot = path.join(root, "qa", "ai");
const testCasesDir = path.join(qaRoot, "test-cases");

const allowedActionTypes = new Set([
  "REQUEST_DOCUMENT",
  "FOLLOW_UP",
  "REQUEST_CLARIFICATION",
  "SCHEDULE_EXCHANGE",
  "INVESTOR_FOLLOW_UP",
]);

const sensitivePatterns = [
  { name: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { name: "http_url", pattern: /https?:\/\/[^\s"']+/gi },
  { name: "signed_url_marker", pattern: /\b(signature|signedUrl|signed_url|X-Amz-Signature)\b/gi },
  { name: "secret_key_marker", pattern: /\b(api[_-]?key|secret|sk-[A-Za-z0-9_-]{8,})\b/gi },
  { name: "long_token", pattern: /\b[A-Za-z0-9_-]{32,}\b/g },
];

const results = [];

function fail(testCase, message) {
  results.push({ ok: false, testCase, message });
}

function pass(testCase, message) {
  results.push({ ok: true, testCase, message });
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function resolveCasePath(caseFile, relativePath) {
  return path.resolve(path.dirname(caseFile), relativePath);
}

function assertArray(value, label, testCase) {
  if (!Array.isArray(value)) {
    fail(testCase, `${label} must be an array`);
    return false;
  }
  return true;
}

function scanForSensitiveValues(value) {
  const text = JSON.stringify(value);
  return sensitivePatterns.flatMap(({ name, pattern }) => {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) ?? [];
    return matches.map((match) => ({ name, match }));
  });
}

function validateAISummaryExpected(expected, testCase) {
  const arrayFields = [
    "summaryMustMention",
    "keyPointsMustInclude",
    "risksMustInclude",
    "suggestedActionTypesMustInclude",
  ];

  for (const field of arrayFields) {
    if (field in expected) assertArray(expected[field], field, testCase);
  }

  if (expected.suggestedActionTypesMustInclude) {
    for (const actionType of expected.suggestedActionTypesMustInclude) {
      if (!allowedActionTypes.has(actionType)) {
        fail(testCase, `unsupported suggested action type in expected: ${actionType}`);
      }
    }
  }
}

function validateFixtureShape(fixture, testCase) {
  if (!fixture.id) fail(testCase, "fixture.id is required");
  if (fixture.provider !== "mock") fail(testCase, "fixture.provider must be mock");

  if (fixture.aiContext) {
    const context = fixture.aiContext;
    for (const field of ["title", "template", "status", "recentMessages", "documents"]) {
      if (!(field in context)) fail(testCase, `aiContext.${field} is required`);
    }
    assertArray(context.recentMessages, "aiContext.recentMessages", testCase);
    assertArray(context.documents, "aiContext.documents", testCase);
  }

  if (fixture.aiOutput?.suggestedActions) {
    for (const action of fixture.aiOutput.suggestedActions) {
      if (!action.label || !action.reason || !allowedActionTypes.has(action.type)) {
        fail(testCase, `invalid suggested action fixture: ${JSON.stringify(action)}`);
      }
    }
  }
}

function validatePrivacyContext(fixture, testCase) {
  if (!fixture.aiContext) return;

  const leaks = scanForSensitiveValues(fixture.aiContext);
  if (leaks.length > 0) {
    fail(
      testCase,
      `privacy context leaks sensitive values: ${leaks.map((leak) => `${leak.name}=${leak.match}`).join(", ")}`,
    );
  }
}

function validateHumanLoop(fixture, expected, testCase) {
  if (!fixture.aiOutput?.suggestedActions) {
    fail(testCase, "human loop fixture must include aiOutput.suggestedActions");
    return;
  }

  if (fixture.initialState?.relationActions?.length !== expected.beforeHumanClick?.relationActionsCreated) {
    fail(testCase, "RelationAction must not exist before human click");
  }

  if (expected.afterHumanClick?.relationActionsCreated !== 1) {
    fail(testCase, "expected human click must create exactly one RelationAction");
  }

  const expectedEventTypes = expected.afterHumanClick?.relationEventTypesMustInclude ?? [];
  if (!expectedEventTypes.includes("AI_SUGGESTED_ACTION_ACCEPTED")) {
    fail(testCase, "expected RelationEvent AI_SUGGESTED_ACTION_ACCEPTED is required");
  }

  const aiEvents = expected.afterHumanClick?.aiEventsMustInclude ?? [];
  if (!aiEvents.some((event) => event.action === "suggested_action" && event.status === "success")) {
    fail(testCase, "expected AIEvent action=suggested_action status=success is required");
  }

  if (expected.afterHumanClick?.emailsSent !== 0) {
    fail(testCase, "AI suggested action acceptance must not send automatic email");
  }
}

function validateInsufficientContext(expected, testCase) {
  if (
    expected.status !== 422 ||
    expected.error !== "INSUFFICIENT_CONTEXT" ||
    expected.message !== "Pas assez de contenu pour une analyse IA pertinente."
  ) {
    fail(testCase, "insufficient context expected response is not aligned with API contract");
  }
}

const testCaseFiles = (await readdir(testCasesDir))
  .filter((file) => file.endsWith(".json"))
  .sort();

for (const fileName of testCaseFiles) {
  const casePath = path.join(testCasesDir, fileName);
  const testCase = await readJson(casePath);
  const label = `${testCase.id} ${testCase.name}`;

  if (testCase.provider !== "mock") fail(label, "test case provider must be mock");
  assertArray(testCase.features, "features", label);
  assertArray(testCase.automatedChecks, "automatedChecks", label);
  assertArray(testCase.manualAcceptanceCriteria, "manualAcceptanceCriteria", label);

  const fixture = await readJson(resolveCasePath(casePath, testCase.fixture));
  const expected = await readJson(resolveCasePath(casePath, testCase.expected));

  validateFixtureShape(fixture, label);
  validatePrivacyContext(fixture, label);

  if (expected.responseShape === "AISummary") {
    validateAISummaryExpected(expected, label);
  }

  if (expected.responseShape === "HumanInTheLoopActionFlow") {
    validateHumanLoop(fixture, expected, label);
  }

  if (expected.responseShape === "AIError") {
    validateInsufficientContext(expected, label);
  }

  pass(label, "JSON, fixture and expected contracts validated");
}

const failures = results.filter((result) => !result.ok);

for (const result of results) {
  const prefix = result.ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${result.testCase}: ${result.message}`);
}

if (failures.length > 0) {
  console.error(`\nAI QA failed: ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`\nAI QA passed: ${testCaseFiles.length} test case(s), mock provider only.`);
