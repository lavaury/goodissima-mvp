import { createCiroBuilderV0 } from "../ciro/path-factory.js";
import type { KnowledgeAccessLayer } from "../knowledge/types.js";
import { resolveIntent } from "./resolve-intent.js";
import type { ResolveIntentOptions, ResolveIntentResult } from "./types.js";

export type ResolveIntentV0 = (text: string, options?: ResolveIntentOptions) => ResolveIntentResult;

export async function createResolveIntentV0(
  knowledge: KnowledgeAccessLayer,
  taxonomyPath: string,
  expressionManifestPath: string,
  ciroPathManifestPath: string,
  modeCatalogPath: string,
  benchmarkPath: string,
): Promise<ResolveIntentV0> {
  const builder = await createCiroBuilderV0(
    knowledge,
    taxonomyPath,
    expressionManifestPath,
    ciroPathManifestPath,
    modeCatalogPath,
    benchmarkPath,
  );
  return (text: string, options?: ResolveIntentOptions) => resolveIntent(text, builder, options);
}
