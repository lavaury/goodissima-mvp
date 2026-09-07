import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import ts from "typescript";

test("web compilation keeps product, QA and tooling without mobile or local-copy globals", () => {
  const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.options.strict, true);
  assert.equal(parsed.options.noEmit, true);
  const roots = parsed.fileNames.map(file => path.relative(process.cwd(), file).replaceAll("\\", "/"));
  for (const prefix of ["app/", "components/", "lib/", "qa/", "scripts/", "emails/", "config/", "goodissima-intent-engine/src/", "goodissima-intent-engine/test/"]) {
    assert.ok(roots.some(file => file.startsWith(prefix)), `Missing web input: ${prefix}`);
  }
  assert.ok(roots.includes("next-env.d.ts"));
  assert.ok(roots.includes("middleware.ts"));
  const program = ts.createProgram(parsed.fileNames, { ...parsed.options, incremental: false });
  const forbidden = program.getSourceFiles().filter(file => /[/\\](m1a|goodissima-mobile|react-native|\.worktrees)[/\\]/.test(file.fileName));
  assert.deepEqual(forbidden.map(file => file.fileName), []);
});

test("Request.formData exposes the browser multipart contract", async () => {
  const input = new FormData();
  input.set("caseId", "case");
  input.set("file", new File(["document"], "document.txt"));
  const request = new Request("https://example.test", { method: "POST", body: input });
  const form = await request.formData();
  assert.equal(form.get("caseId"), "case");
  const file = form.get("file");
  assert.ok(file instanceof File);
  assert.equal(file.size, 8);
  assert.equal([...form.entries()].length, 2);
});
