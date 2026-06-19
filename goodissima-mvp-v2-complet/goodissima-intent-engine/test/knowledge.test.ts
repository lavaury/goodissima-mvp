import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";

test("loads and searches only manifest knowledge", async () => {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const manifestPath = path.resolve(
    testDirectory,
    "../../knowledge/manifests/goodissima.manifest.json",
  );
  const knowledge = await FileSystemKnowledgeAccessLayer.fromManifest(manifestPath);

  const documents = await knowledge.list();
  assert.ok(documents.length > 0);
  assert.equal(await knowledge.get("not-in-manifest"), undefined);

  const results = await knowledge.search("human-in-the-loop");
  assert.ok(results.length > 0);
  assert.ok(results.every((result) => result.knowledgeId.length > 0));
});
