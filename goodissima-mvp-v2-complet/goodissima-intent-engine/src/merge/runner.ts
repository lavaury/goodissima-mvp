import { loadCorpus } from "../corpus/loader.js";
import { readCiroPathManifest, validateCiroPathManifest } from "../ciro/path-manifest.js";
import { readIntentTaxonomy } from "../detector/manifest.js";
import { readModeCatalog } from "../detector/mode-catalog.js";
import type { KnowledgeAccessLayer } from "../knowledge/types.js";
import { validateMergeGovernance } from "./governance.js";
import {
  loadCompatibilityMatrix,
  loadMergeBenchmark,
  loadScoringRules,
} from "./loader.js";

export async function runMergeGovernance(input: {
  knowledge: KnowledgeAccessLayer;
  taxonomyPath: string;
  modeCatalogPath: string;
  ciroPathManifestPath: string;
  compatibilityMatrixPath: string;
  scoringRulesPath: string;
  mergeBenchmarkPath: string;
}) {
  const corpus = await loadCorpus(input.knowledge);
  const paths = validateCiroPathManifest(
    await readCiroPathManifest(input.ciroPathManifestPath),
    await readIntentTaxonomy(input.taxonomyPath),
    corpus,
    await readModeCatalog(input.modeCatalogPath),
  );
  return validateMergeGovernance({
    matrix: await loadCompatibilityMatrix(input.compatibilityMatrixPath),
    scoringRules: await loadScoringRules(input.scoringRulesPath),
    benchmark: await loadMergeBenchmark(input.mergeBenchmarkPath),
    corpus,
    ciroPaths: paths,
  });
}
