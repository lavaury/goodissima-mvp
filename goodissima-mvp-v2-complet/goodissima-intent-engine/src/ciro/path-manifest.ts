import { readFile } from "node:fs/promises";
import type { Corpus } from "../corpus/types.js";
import type { IntentTaxonomy, ModeCatalog } from "../detector/types.js";
import type { CiroPathManifest, ValidatedCiroPath } from "./path-types.js";

export async function readCiroPathManifest(filePath: string): Promise<CiroPathManifest> {
  return JSON.parse(await readFile(filePath, "utf8")) as CiroPathManifest;
}

export function validateCiroPathManifest(
  manifest: CiroPathManifest,
  taxonomy: IntentTaxonomy,
  corpus: Corpus,
  modeCatalog?: ModeCatalog,
): ValidatedCiroPath[] {
  if (manifest?.version !== "1.0" || !Array.isArray(manifest.paths)) {
    throw new Error("Unsupported or invalid CIRO path manifest.");
  }
  const intents = new Set(taxonomy.intents.map(({ id }) => id));
  const taxonomyModes = new Set(taxonomy.modes.map(({ id }) => id));
  const catalogModes = new Set((modeCatalog?.modes ?? taxonomy.modes).map(({ id }) => id));
  const keys = new Set<string>();

  return manifest.paths.map((path, index) => {
    if (!intents.has(path.intent)) throw new Error(`CIRO path ${index} has an unknown intent.`);
    if (!taxonomyModes.has(path.mode) || !catalogModes.has(path.mode)) throw new Error(`CIRO path ${index} has an unknown mode.`);
    const key = `${path.intent}\u0000${path.mode}`;
    if (keys.has(key)) throw new Error(`Duplicate CIRO path: ${path.intent}/${path.mode}.`);
    keys.add(key);

    const ground = (mapping: { knowledgeId: string; expression: string }) => {
      const unit = corpus.units.find(
        (candidate) => candidate.knowledgeId === mapping.knowledgeId && candidate.content.includes(mapping.expression),
      );
      if (!unit) throw new Error(`CIRO mapping expression is not source-grounded: ${mapping.expression}.`);
      return { ...mapping, unitId: unit.id, locator: unit.locator };
    };
    if (!Array.isArray(path.roleProjection.roles) || path.roleProjection.roles.length === 0) {
      throw new Error(`CIRO path ${index} requires explicit roles.`);
    }
    return {
      ...path,
      roleEvidence: ground(path.roleProjection),
      relationshipEvidence: ground(path.relationshipResolution),
    };
  });
}
