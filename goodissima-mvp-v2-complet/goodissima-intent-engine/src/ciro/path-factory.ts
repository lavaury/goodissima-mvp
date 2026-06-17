import { loadCorpus } from "../corpus/loader.js";
import { validateCorpus } from "../corpus/validator.js";
import { createDeterministicIntentDetectorV0 } from "../detector/factory.js";
import { readIntentTaxonomy, validateIntentTaxonomy } from "../detector/manifest.js";
import { readExpressionManifest } from "../detector/manifest.js";
import { readModeCatalog } from "../detector/mode-catalog.js";
import type { KnowledgeAccessLayer } from "../knowledge/types.js";
import { CiroBuilderV0 } from "./builder.js";
import { readCiroPathManifest } from "./path-manifest.js";
import { validateCiroPathGovernance } from "./governance.js";
import { readFile } from "node:fs/promises";
import type { BenchmarkDataset } from "../benchmark/types.js";

export async function createCiroBuilderV0(
  knowledge: KnowledgeAccessLayer,
  taxonomyPath: string,
  expressionManifestPath: string,
  ciroPathManifestPath: string,
  modeCatalogPath: string,
  benchmarkPath: string,
): Promise<CiroBuilderV0> {
  const documents = await knowledge.list();
  const corpus = await loadCorpus(knowledge);
  const corpusValidation = validateCorpus(corpus, { documents });
  if (!corpusValidation.valid) throw new Error("Cannot create CIRO builder from an invalid corpus.");

  const taxonomy = await readIntentTaxonomy(taxonomyPath);
  const governance = validateCiroPathGovernance({
    taxonomy,
    modeCatalog: await readModeCatalog(modeCatalogPath),
    expressionManifest: await readExpressionManifest(expressionManifestPath),
    pathManifest: await readCiroPathManifest(ciroPathManifestPath),
    benchmark: JSON.parse(await readFile(benchmarkPath, "utf8")) as BenchmarkDataset,
    corpus,
  });
  if (!governance.valid) throw new Error(`CIRO governance failed: ${governance.issues[0].message}`);
  const detector = await createDeterministicIntentDetectorV0(
    knowledge,
    taxonomyPath,
    expressionManifestPath,
    modeCatalogPath,
  );
  return new CiroBuilderV0(detector, governance.paths);
}
