CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS "RelationEmbedding_vector_cosine_idx"
  ON "RelationEmbedding"
  USING ivfflat ("vector" vector_cosine_ops)
  WITH (lists = 100);
