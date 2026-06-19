import { loadCorpus } from "../corpus/loader.js";
import { validateCorpus } from "../corpus/validator.js";
import type { KnowledgeAccessLayer } from "../knowledge/types.js";
import {
  readExpressionManifest,
  readIntentTaxonomy,
  validateExpressionManifest,
  validateIntentTaxonomy,
} from "./manifest.js";
import { DeterministicIntentDetectorV0 } from "./detector.js";
import { readModeCatalog, validateModeCatalog } from "./mode-catalog.js";

export async function createDeterministicIntentDetectorV0(
  knowledge: KnowledgeAccessLayer,
  taxonomyPath: string,
  manifestPath: string,
  modeCatalogPath: string,
): Promise<DeterministicIntentDetectorV0> {
  const documents = await knowledge.list();
  const corpus = await loadCorpus(knowledge);
  const corpusValidation = validateCorpus(corpus, { documents });
  if (!corpusValidation.valid) {
    throw new Error(`Cannot create detector from invalid corpus: ${corpusValidation.issues[0].message}`);
  }

  const modeCatalogValidation = validateModeCatalog(
    await readModeCatalog(modeCatalogPath),
    corpus,
  );
  if (!modeCatalogValidation.valid) {
    throw new Error(`Invalid mode catalog: ${modeCatalogValidation.issues[0].message}`);
  }
  const taxonomyValidation = validateIntentTaxonomy(
    await readIntentTaxonomy(taxonomyPath),
    corpus,
    modeCatalogValidation.catalog,
  );
  if (!taxonomyValidation.valid) {
    throw new Error(`Invalid intent taxonomy: ${taxonomyValidation.issues[0].message}`);
  }
  const manifestValidation = validateExpressionManifest(
    await readExpressionManifest(manifestPath),
    taxonomyValidation.taxonomy,
    corpus,
    modeCatalogValidation.catalog,
  );
  if (!manifestValidation.valid) {
    throw new Error(`Invalid expression manifest: ${manifestValidation.issues[0].message}`);
  }
  return new DeterministicIntentDetectorV0(manifestValidation.entries);
}
