import type { EmbeddingProvider, EmbeddingRequest, EmbeddingResult } from "@/lib/ai/embeddings/types";

const dimensions = 32;

function hashToken(token: string) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicEmbedding(input: string) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % dimensions;
    vector[index] += hash % 2 === 0 ? 1 : -1;
  }

  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export const mockEmbeddingProvider: EmbeddingProvider = {
  name: "mock",
  model: "mock-deterministic-embedding-v1",
  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    return {
      provider: "mock",
      model: this.model,
      vector: deterministicEmbedding(request.input),
    };
  },
};
