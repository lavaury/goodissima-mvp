import { readFile } from "node:fs/promises";
import { runCiroBenchmark } from "../benchmark/ciro-runner.js";
import { runDetectorBenchmark } from "../benchmark/detector-runner.js";
import type { BenchmarkDataset } from "../benchmark/types.js";
import { loadCorpus } from "../corpus/loader.js";
import { createCiroBuilderV0 } from "../ciro/path-factory.js";
import { readCiroPathManifest } from "../ciro/path-manifest.js";
import { validateCiroPathGovernance } from "../ciro/governance.js";
import { createDeterministicIntentDetectorV0 } from "../detector/factory.js";
import { readExpressionManifest, readIntentTaxonomy } from "../detector/manifest.js";
import { readModeCatalog } from "../detector/mode-catalog.js";
import type { KnowledgeAccessLayer } from "../knowledge/types.js";
import { resolveIntent } from "../resolve/resolve-intent.js";
import { createResolutionQualityReport } from "./dashboard.js";
import type { ResolutionQualityReport } from "./types.js";
import { validateBenchmarkAnnotations } from "../benchmark/annotations.js";

async function readDataset(filePath: string): Promise<BenchmarkDataset> {
  return JSON.parse(await readFile(filePath, "utf8")) as BenchmarkDataset;
}

export async function runResolutionQualityDashboard(input: {
  knowledge: KnowledgeAccessLayer;
  taxonomyPath: string;
  expressionManifestPath: string;
  modeCatalogPath: string;
  ciroPathManifestPath: string;
  detectorBenchmarkPath: string;
  ciroBenchmarkPath: string;
}): Promise<ResolutionQualityReport> {
  const documents = await input.knowledge.list();
  const corpus = await loadCorpus(input.knowledge);
  const taxonomy = await readIntentTaxonomy(input.taxonomyPath);
  const expressionManifest = await readExpressionManifest(input.expressionManifestPath);
  const modeCatalog = await readModeCatalog(input.modeCatalogPath);
  const pathManifest = await readCiroPathManifest(input.ciroPathManifestPath);
  const detectorDataset = await readDataset(input.detectorBenchmarkPath);
  const ciroDataset = await readDataset(input.ciroBenchmarkPath);
  const detectorAnnotations = validateBenchmarkAnnotations(
    detectorDataset,
    expressionManifest,
    corpus,
  );
  if (!detectorAnnotations.valid) {
    throw new Error(`Detector benchmark annotation failed: ${detectorAnnotations.issues[0].message}`);
  }
  const governance = validateCiroPathGovernance({
    taxonomy,
    modeCatalog,
    expressionManifest,
    pathManifest,
    benchmark: ciroDataset,
    corpus,
  });
  if (!governance.valid) {
    throw new Error(`Quality governance failed: ${governance.issues[0].message}`);
  }

  const detector = await createDeterministicIntentDetectorV0(
    input.knowledge,
    input.taxonomyPath,
    input.expressionManifestPath,
    input.modeCatalogPath,
  );
  const builder = await createCiroBuilderV0(
    input.knowledge,
    input.taxonomyPath,
    input.expressionManifestPath,
    input.ciroPathManifestPath,
    input.modeCatalogPath,
    input.ciroBenchmarkPath,
  );
  return createResolutionQualityReport({
    detectorDataset,
    detectorReport: await runDetectorBenchmark(detectorDataset, detector),
    ciroDataset,
    ciroReport: runCiroBenchmark(ciroDataset, builder),
    governance,
    resolve: (text) => resolveIntent(text, builder),
    documents,
    expressionManifest,
  });
}
