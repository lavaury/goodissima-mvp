CREATE EXTENSION IF NOT EXISTS vector;

DROP INDEX IF EXISTS "RelationEmbedding_vector_cosine_idx";

ALTER TABLE "RelationEmbedding"
  ALTER COLUMN "vector" TYPE vector(32)
  USING "vector"::vector(32);

CREATE INDEX IF NOT EXISTS "RelationEmbedding_vector_cosine_idx"
  ON "RelationEmbedding"
  USING ivfflat ("vector" vector_cosine_ops)
  WITH (lists = 100);
