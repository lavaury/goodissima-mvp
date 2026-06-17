import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCiroBenchmark } from "../src/benchmark/ciro-runner.js";
import type { BenchmarkDataset } from "../src/benchmark/types.js";
import { loadCorpus } from "../src/corpus/loader.js";
import { createCiroBuilderV0 } from "../src/ciro/path-factory.js";
import { validateCiroPathGovernance } from "../src/ciro/governance.js";
import { readCiroPathManifest, validateCiroPathManifest } from "../src/ciro/path-manifest.js";
import { RelationshipResolverV0 } from "../src/ciro/relationship-resolver.js";
import { RoleProjectorV0 } from "../src/ciro/role-projector.js";
import { readExpressionManifest, readIntentTaxonomy } from "../src/detector/manifest.js";
import { readModeCatalog } from "../src/detector/mode-catalog.js";
import { FileSystemKnowledgeAccessLayer } from "../src/knowledge/filesystem.js";

async function fixture() {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(testDirectory, "../..");
  const taxonomyPath = path.join(root, "knowledge/detector/intent-taxonomy.v0.json");
  const expressionsPath = path.join(root, "knowledge/detector/expression-manifest.v0.json");
  const pathsPath = path.join(root, "knowledge/ciro/paths.v0.json");
  const modeCatalogPath = path.join(root, "knowledge/detector/mode-catalog.v0.json");
  const benchmarkPath = path.join(root, "knowledge/benchmarks/ciro.v0.json");
  const knowledge = await FileSystemKnowledgeAccessLayer.fromManifest(
    path.join(root, "knowledge/manifests/goodissima.manifest.json"),
  );
  const corpus = await loadCorpus(knowledge);
  const paths = validateCiroPathManifest(
    await readCiroPathManifest(pathsPath),
    await readIntentTaxonomy(taxonomyPath),
    corpus,
    await readModeCatalog(modeCatalogPath),
  );
  const builder = await createCiroBuilderV0(
    knowledge,
    taxonomyPath,
    expressionsPath,
    pathsPath,
    modeCatalogPath,
    benchmarkPath,
  );
  const governanceInput = {
    taxonomy: await readIntentTaxonomy(taxonomyPath),
    modeCatalog: await readModeCatalog(modeCatalogPath),
    expressionManifest: await readExpressionManifest(expressionsPath),
    pathManifest: await readCiroPathManifest(pathsPath),
    benchmark: JSON.parse(await readFile(benchmarkPath, "utf8")) as BenchmarkDataset,
    corpus,
  };
  return { benchmarkPath, builder, corpus, expressionsPath, governanceInput, knowledge, modeCatalogPath, paths, pathsPath, root, taxonomyPath };
}

test("Role Projector v0 returns only the explicit rental roles", async () => {
  const { paths } = await fixture();
  assert.equal(paths.length, 6);
  const result = new RoleProjectorV0(paths).project("PROPERTY_RENTAL", "SEARCH");
  assert.deepEqual(result?.roles, ["locataire", "proprietaire"]);
  assert.equal(result?.evidence.expression, "locataire et proprietaire");
  assert.deepEqual(
    new RoleProjectorV0(paths).project("HOUSING", "SEARCH")?.roles,
    ["locataire", "proprietaire"],
  );
  assert.deepEqual(
    new RoleProjectorV0(paths).project("EMPLOYMENT", "SEARCH")?.roles,
    ["candidat", "recruteur"],
  );
  assert.equal(new RoleProjectorV0(paths).project("FREELANCE", "SEARCH"), undefined);
});

test("Relationship Resolver v0 returns only the explicit rental relationship", async () => {
  const { paths } = await fixture();
  const result = new RelationshipResolverV0(paths).resolve("PROPERTY_RENTAL", "SEARCH");
  assert.equal(result?.relationship, "PROPERTY_RENTAL");
  assert.equal(result?.evidence.expression, "REAL_ESTATE_RENTAL_POLICY");
  assert.equal(new RelationshipResolverV0(paths).resolve("PROPERTY_RENTAL", "mode souverain"), undefined);
});

test("CIRO Builder v0 produces the first complete explicit path", async () => {
  const { builder } = await fixture();
  const ciro = builder.build("rechercher un dossier locataire");
  assert.deepEqual(ciro?.c, { intent: "PROPERTY_RENTAL", mode: "SEARCH" });
  assert.deepEqual(ciro?.r, { roles: ["locataire", "proprietaire"] });
  assert.deepEqual(ciro?.o, { relationship: "PROPERTY_RENTAL" });
  assert.ok(ciro && ciro.sources.length === 3);
  assert.equal("trustPolicy" in (ciro ?? {}), false);
});

test("CIRO Builder v0 refuses an incomplete or unmapped path", async () => {
  const { builder } = await fixture();
  assert.equal(builder.build("dossier locataire"), undefined);
  assert.ok(builder.build("rechercher recrutement"));
  assert.ok(builder.build("DOCUMENT_REQUEST immobilier"));
  assert.equal(builder.build("rechercher freelance"), undefined);
});

test("CIRO benchmark validates complete and incomplete paths", async () => {
  const { builder, paths, root } = await fixture();
  const dataset = JSON.parse(
    await readFile(path.join(root, "knowledge/benchmarks/ciro.v0.json"), "utf8"),
  ) as BenchmarkDataset;
  const report = runCiroBenchmark(dataset, builder);
  assert.equal(report.total, 8);
  assert.equal(report.passed, 8);
  assert.equal(report.failed, 0);

  const benchmarkPaths = new Set(
    dataset.cases.flatMap((benchmarkCase) => {
      const c = benchmarkCase.expected?.c;
      if (typeof c !== "object" || c === null || Array.isArray(c)) return [];
      return typeof c.intent === "string" && typeof c.mode === "string"
        ? [`${c.intent}\u0000${c.mode}`]
        : [];
    }),
  );
  assert.deepEqual(
    benchmarkPaths,
    new Set(paths.map((path) => `${path.intent}\u0000${path.mode}`)),
  );
});

test("CIRO governance rejects an unknown mode", async () => {
  const { governanceInput } = await fixture();
  const input = structuredClone(governanceInput);
  input.pathManifest.paths[0].mode = "UNKNOWN_MODE";
  const result = validateCiroPathGovernance(input);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "unknown_mode"));
});

test("CIRO governance rejects a path without benchmark coverage", async () => {
  const { governanceInput } = await fixture();
  const input = structuredClone(governanceInput);
  input.benchmark.cases = input.benchmark.cases.filter(
    (benchmarkCase) => benchmarkCase.id !== "employment-document-request",
  );
  const result = validateCiroPathGovernance(input);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "path_without_benchmark"));
});

test("CIRO governance rejects a path without source grounding", async () => {
  const { governanceInput } = await fixture();
  const input = structuredClone(governanceInput);
  input.pathManifest.paths[0].roleProjection.expression = "expression absente";
  const result = validateCiroPathGovernance(input);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((issue) => issue.code === "path_without_source"));
});

test("CIRO governance accepts the complete governed path set", async () => {
  const { governanceInput } = await fixture();
  const result = validateCiroPathGovernance(governanceInput);
  assert.equal(result.valid, true);
  assert.equal(result.valid && result.paths.length, 6);
});
