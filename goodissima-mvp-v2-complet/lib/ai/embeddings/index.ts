import { mockEmbeddingProvider } from "@/lib/ai/embeddings/mock";
import type { EmbeddingProvider } from "@/lib/ai/embeddings/types";

export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = (process.env.AI_EMBEDDING_PROVIDER ?? process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (provider === "mistral" || provider === "openai") {
    // Future-ready extension point. Mock remains default until remote embedding
    // credentials, model selection and persistence strategy are explicit.
    return mockEmbeddingProvider;
  }

  return mockEmbeddingProvider;
}

export { deterministicEmbedding } from "@/lib/ai/embeddings/mock";
export type { EmbeddingProvider, EmbeddingResult, EmbeddingType } from "@/lib/ai/embeddings/types";
