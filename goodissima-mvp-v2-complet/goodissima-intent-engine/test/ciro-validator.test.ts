import assert from "node:assert/strict";
import test from "node:test";
import { validateCiro } from "../src/ciro/validator.js";

test("accepts a source-grounded CIRO record", () => {
  const result = validateCiro(
    {
      schemaVersion: "1.0",
      c: {},
      i: null,
      r: [],
      o: "",
      sources: [{ knowledgeId: "governance", locator: "line:1" }],
    },
    { knownKnowledgeIds: new Set(["governance"]) },
  );

  assert.equal(result.valid, true);
});

test("rejects missing and unknown sources", () => {
  const result = validateCiro(
    {
      schemaVersion: "1.0",
      c: {},
      i: {},
      r: {},
      o: {},
      sources: [{ knowledgeId: "invented" }],
    },
    { knownKnowledgeIds: new Set(["provided"]) },
  );

  assert.equal(result.valid, false);
  assert.ok(
    !result.valid &&
      result.issues.some((issue) => issue.code === "unknown_knowledge_source"),
  );
});
