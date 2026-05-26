CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "RelationEmbedding" (
  "id" TEXT NOT NULL,
  "relationCaseId" TEXT NOT NULL,
  "embeddingType" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "vector" vector,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RelationEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RelationEmbedding_relationCaseId_embeddingType_idx" ON "RelationEmbedding"("relationCaseId", "embeddingType");
CREATE INDEX "RelationEmbedding_contentHash_idx" ON "RelationEmbedding"("contentHash");
CREATE INDEX "RelationEmbedding_vector_cosine_idx" ON "RelationEmbedding" USING ivfflat ("vector" vector_cosine_ops) WITH (lists = 100);

ALTER TABLE "RelationEmbedding"
  ADD CONSTRAINT "RelationEmbedding_relationCaseId_fkey"
  FOREIGN KEY ("relationCaseId") REFERENCES "RelationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
