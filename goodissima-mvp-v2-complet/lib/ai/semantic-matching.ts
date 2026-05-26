import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractMatchingProfile, rankMatches, type AIMatchCandidate, type AIMatchingProfile } from "@/lib/ai/matching";
import { deterministicEmbedding, getEmbeddingProvider, type EmbeddingType } from "@/lib/ai/embeddings";

const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const urlPattern = /https?:\/\/[^\s]+/g;
const tokenPattern = /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{24,}\b/g;
const secretPattern = /\b(api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi;

function sanitizeText(value: string) {
  return value
    .replace(emailPattern, "[private-email]")
    .replace(urlPattern, "[private-url]")
    .replace(secretPattern, "[private-secret]")
    .replace(tokenPattern, "[private-token]")
    .slice(0, 4000);
}

function contentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  return dot / ((Math.sqrt(normA) || 1) * (Math.sqrt(normB) || 1));
}

function toPgVector(vector: number[]) {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(",")}]`;
}

function profileText(profile: AIMatchingProfile) {
  return [
    ...profile.categories,
    ...profile.interests,
    ...profile.constraints,
    profile.location,
    profile.budget,
    profile.availability,
    profile.relationType,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function generateCaseEmbedding(caseId: string, embeddingType: EmbeddingType = "case_summary") {
  const relationCase = await prisma.relationCase.findUnique({
    where: { id: caseId },
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

  const profile = extractMatchingProfile({
    templateKey: relationCase.template?.key,
    templateName: relationCase.template?.name,
    title: relationCase.gLink.title,
    messages: relationCase.messages.map((message) => message.body),
    documents: relationCase.documents.map((document) => document.fileName),
    aiInstructions: relationCase.template?.aiInstructions,
  });
  const input = sanitizeText(
    [
      relationCase.template?.key,
      relationCase.template?.name,
      relationCase.template?.aiInstructions,
      relationCase.gLink.title,
      profileText(profile),
      ...relationCase.messages.map((message) => message.body),
      ...relationCase.documents.map((document) => document.fileName),
      ...relationCase.relationActions.map((action) => `${action.status} ${action.title} ${action.description ?? ""}`),
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const provider = getEmbeddingProvider();
  const result = await provider.embed({ input, metadata: { caseId, embeddingType } });
  const hash = contentHash(input);

  const embedding = await prisma.relationEmbedding.create({
    data: {
      relationCaseId: relationCase.id,
      embeddingType,
      contentHash: hash,
    },
    select: { id: true },
  });

  await prisma.$executeRawUnsafe(
    `UPDATE "RelationEmbedding" SET "vector" = $1::vector WHERE "id" = $2`,
    toPgVector(result.vector),
    embedding.id,
  );

  await prisma.aIEvent.create({
    data: {
      caseId: relationCase.id,
      provider: result.provider,
      model: result.model,
      action: "embedding_generated",
      status: "success",
      promptVersion: "semantic-matching-v2",
      outputSummary: `${embeddingType}:${hash.slice(0, 12)}`,
    },
  });

  return { profile, contentHash: hash, vector: result.vector, provider: result.provider, model: result.model };
}

export async function semanticVectorSearch({
  sourceVector,
  ownerId,
  templateKey,
  excludeCaseId,
  topK = 8,
  threshold = 0.35,
}: {
  sourceVector: number[];
  ownerId: string;
  templateKey: string | null;
  excludeCaseId: string;
  topK?: number;
  threshold?: number;
}) {
  const startedAt = Date.now();
  const vector = toPgVector(sourceVector);
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      relationCaseId: string;
      distance: number;
    }>
  >(
    `
    SELECT e."relationCaseId", (e."vector" <=> $1::vector) AS distance
    FROM "RelationEmbedding" e
    JOIN "RelationCase" c ON c."id" = e."relationCaseId"
    LEFT JOIN "RelationTemplate" t ON t."id" = c."templateId"
    WHERE c."ownerId" = $2
      AND c."matchingEnabled" = true
      AND c."id" <> $3
      AND e."embeddingType" = 'case_summary'
      AND e."vector" IS NOT NULL
      AND COALESCE(t."key", '') = COALESCE($4, '')
      AND (1 - (e."vector" <=> $1::vector)) >= $5
    ORDER BY e."vector" <=> $1::vector
    LIMIT $6
    `,
    vector,
    ownerId,
    excludeCaseId,
    templateKey ?? "",
    threshold,
    topK,
  );

  console.info("[matching] semantic vector search", {
    durationMs: Date.now() - startedAt,
    candidateCount: rows.length,
    topMatches: rows.map((row) => row.relationCaseId),
  });

  return rows.map((row) => ({
    relationCaseId: row.relationCaseId,
    internalSimilarity: 1 - Number(row.distance),
  }));
}

export function semanticMatchV2(source: AIMatchingProfile, candidates: AIMatchCandidate[]) {
  const sourceVector = deterministicEmbedding(profileText(source));
  const lexicalMatches = rankMatches(source, candidates);

  return candidates
    .filter((candidate) => candidate.profile.relationType === source.relationType)
    .map((candidate) => {
      const candidateVector = deterministicEmbedding(profileText(candidate.profile));
      const similarity = cosineSimilarity(sourceVector, candidateVector);
      const lexical = lexicalMatches.find((match) => match.relationId === candidate.id);
      const compatibleElements = lexical?.explanation.compatibleElements ?? [];
      const semanticSignals = similarity > 0.45 ? ["Correspondance semantique detectee"] : [];
      if (similarity > 0.55) semanticSignals.push("Vocabulaire proche malgre formulations differentes");
      const clarificationsNeeded = lexical?.explanation.clarificationsNeeded ?? [];
      const warnings = lexical?.explanation.warnings ?? [];
      if (semanticSignals.length > 0 && compatibleElements.length === 0) {
        clarificationsNeeded.push("Verifier la compatibilite semantique avant proposition.");
      }

      return {
        relationId: candidate.id,
        pseudonym: candidate.pseudonym,
        explanation: {
          compatibleElements,
          semanticSignals,
          clarificationsNeeded,
          warnings,
        },
        internalSimilarity: similarity,
      };
    })
    .filter((match) => match.explanation.compatibleElements.length > 0 || match.explanation.semanticSignals.length > 0)
    .sort((a, b) => b.internalSimilarity - a.internalSimilarity)
    .slice(0, 8)
    .map(({ internalSimilarity: _internalSimilarity, ...match }) => match);
}
