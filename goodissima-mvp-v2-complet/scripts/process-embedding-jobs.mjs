import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const maxAttempts = 3;
const batchSize = Number(process.env.EMBEDDING_JOB_BATCH_SIZE ?? 10);
const dimensions = 32;

function sanitizeText(value) {
  return value
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[private-email]")
    .replace(/https?:\/\/[^\s]+/g, "[private-url]")
    .replace(/\b(api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "[private-secret]")
    .replace(/\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}\b/g, "[private-token]")
    .slice(0, 4000);
}

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicEmbedding(input) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = input.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) vector[hashToken(token) % dimensions] += hashToken(token) % 2 === 0 ? 1 : -1;
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function toPgVector(vector) {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(",")}]`;
}

async function buildContext(relationCaseId) {
  const relationCase = await prisma.relationCase.findUnique({
    where: { id: relationCaseId },
    select: {
      id: true,
      gLink: { select: { title: true } },
      template: { select: { key: true, name: true, aiInstructions: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 20, select: { body: true } },
      documents: { orderBy: { createdAt: "desc" }, take: 10, select: { fileName: true } },
      relationActions: { orderBy: { createdAt: "desc" }, take: 10, select: { title: true, description: true, status: true } },
    },
  });

  if (!relationCase) throw new Error("CASE_NOT_FOUND");

  return sanitizeText(
    [
      relationCase.template?.key,
      relationCase.template?.name,
      relationCase.template?.aiInstructions,
      relationCase.gLink.title,
      ...relationCase.messages.map((message) => message.body),
      ...relationCase.documents.map((document) => document.fileName),
      ...relationCase.relationActions.map((action) => `${action.status} ${action.title} ${action.description ?? ""}`),
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function generateEmbedding(relationCaseId) {
  const input = await buildContext(relationCaseId);
  const vector = deterministicEmbedding(input);
  const contentHash = createHash("sha256").update(input).digest("hex");
  const embedding = await prisma.relationEmbedding.create({
    data: { relationCaseId, embeddingType: "case_summary", contentHash },
    select: { id: true },
  });
  await prisma.$executeRawUnsafe(
    `UPDATE "RelationEmbedding" SET "vector" = $1::vector WHERE "id" = $2`,
    toPgVector(vector),
    embedding.id,
  );
  await prisma.aIEvent.create({
    data: {
      caseId: relationCaseId,
      provider: "mock",
      model: "mock-deterministic-embedding-v1",
      action: "embedding_generated",
      status: "success",
      promptVersion: "embedding-pipeline-v2.2",
      outputSummary: `case_summary:${contentHash.slice(0, 12)}`,
    },
  });
  await prisma.relationCase.update({
    where: { id: relationCaseId },
    data: { embeddingStatus: "fresh", embeddingUpdatedAt: new Date() },
  });
  return { vector, contentHash, contextLength: input.length };
}

async function processJob(job) {
  const startedAt = Date.now();
  await prisma.embeddingJob.update({
    where: { id: job.id },
    data: { status: "processing", attempts: { increment: 1 } },
  });
  await prisma.relationCase.update({
    where: { id: job.relationCaseId },
    data: { embeddingStatus: "processing" },
  });

  try {
    if (process.env.EMBEDDING_WORKER_FORCE_FAIL === "1") throw new Error("FORCED_EMBEDDING_FAILURE");
    const result = await generateEmbedding(job.relationCaseId);
    await prisma.embeddingJob.update({
      where: { id: job.id },
      data: { status: "completed", processedAt: new Date(), lastError: null },
    });
    console.info("[embeddings] job completed", {
      jobId: job.id,
      relationCaseId: job.relationCaseId,
      durationMs: Date.now() - startedAt,
      contextLength: result.contextLength,
      embeddingCount: 1,
      vectorDimensions: result.vector.length,
      attempts: job.attempts + 1,
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN_EMBEDDING_ERROR";
    const nextAttempts = job.attempts + 1;
    const failed = nextAttempts >= maxAttempts;
    await prisma.embeddingJob.update({
      where: { id: job.id },
      data: { status: failed ? "failed" : "pending", lastError: errorCode, processedAt: failed ? new Date() : null },
    });
    await prisma.relationCase.update({ where: { id: job.relationCaseId }, data: { embeddingStatus: "stale" } });
    if (failed) {
      await prisma.aIEvent.create({
        data: {
          caseId: job.relationCaseId,
          provider: "goodissima",
          model: "embedding-worker",
          action: "embedding_job_failed",
          status: "error",
          promptVersion: "embedding-pipeline-v2.2",
          errorCode,
        },
      });
    }
    console.info("[embeddings] job retry/failure", {
      jobId: job.id,
      relationCaseId: job.relationCaseId,
      durationMs: Date.now() - startedAt,
      attempts: nextAttempts,
      failed,
      errorCode,
    });
  }
}

const jobs = await prisma.embeddingJob.findMany({
  where: { status: "pending", attempts: { lt: maxAttempts } },
  orderBy: { createdAt: "asc" },
  take: batchSize,
});
console.info("[embeddings] worker batch", { jobCount: jobs.length, batchSize });

for (const job of jobs) await processJob(job);

await prisma.$disconnect();
