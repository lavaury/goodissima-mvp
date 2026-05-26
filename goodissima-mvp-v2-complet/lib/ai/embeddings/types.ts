export type EmbeddingProviderName = "mock" | "mistral" | "openai";

export type EmbeddingType = "case_summary" | "interests" | "constraints" | "timeline" | "messages";

export type EmbeddingRequest = {
  input: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type EmbeddingResult = {
  provider: EmbeddingProviderName;
  model: string;
  vector: number[];
};

export type EmbeddingProvider = {
  name: EmbeddingProviderName;
  model: string;
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
};
