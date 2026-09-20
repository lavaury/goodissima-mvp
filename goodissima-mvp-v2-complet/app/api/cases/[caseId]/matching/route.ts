import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { rankMatches } from "@/lib/ai/matching";
import { deterministicEmbedding } from "@/lib/ai/embeddings";
import { getStoredCaseEmbedding, semanticMatchV2, semanticVectorSearch } from "@/lib/ai/semantic-matching";
import { prisma } from "@/lib/prisma";
import { matchingProfileFromSource } from "@/lib/ai/relational-matching-source";

export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: {
        id: true,
        matchingEnabled: true,
        embeddingStatus: true,
        candidateName: true,
        gLink: { select: { id: true, title: true } },
        template: { select: { key: true, name: true, aiInstructions: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 20, select: { body: true } },
        documents: { orderBy: { createdAt: "desc" }, take: 10, select: { fileName: true } },
      },
    });

    if (!relationCase) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    if (!relationCase.matchingEnabled) {
      return NextResponse.json({ error: "MATCHING_DISABLED" }, { status: 409 });
    }

    const sourceProfile = matchingProfileFromSource({
      sourceType: "RELATION_CASE", sourceId: relationCase.id, relationCaseId: relationCase.id,
      gLinkId: relationCase.gLink.id, ownerId: owner.id, title: relationCase.gLink.title,
      templateKey: relationCase.template?.key, templateName: relationCase.template?.name,
      messages: relationCase.messages.map((message) => message.body),
      documents: relationCase.documents.map((document) => document.fileName),
      aiInstructions: relationCase.template?.aiInstructions,
    });

    const candidates = await prisma.relationCase.findMany({
      where: {
        ownerId: owner.id,
        matchingEnabled: true,
        id: { not: relationCase.id },
      },
      take: 80,
      select: {
        id: true,
        candidateName: true,
        gLink: { select: { id: true, title: true } },
        template: { select: { key: true, name: true, aiInstructions: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 20, select: { body: true } },
        documents: { orderBy: { createdAt: "desc" }, take: 10, select: { fileName: true } },
      },
    });

    const sameTemplateCandidates = candidates
      .filter((candidate) => (candidate.template?.key ?? null) === (relationCase.template?.key ?? null))
      .map((candidate, index) => ({
        id: candidate.id,
        pseudonym: `Relation compatible ${index + 1}`,
        templateKey: candidate.template?.key ?? null,
        profile: matchingProfileFromSource({
          sourceType: "RELATION_CASE", sourceId: candidate.id, relationCaseId: candidate.id,
          gLinkId: candidate.gLink.id, ownerId: owner.id, title: candidate.gLink.title,
          templateKey: candidate.template?.key, templateName: candidate.template?.name,
          messages: candidate.messages.map((message) => message.body),
          documents: candidate.documents.map((document) => document.fileName),
          aiInstructions: candidate.template?.aiInstructions,
        }),
      }));

    const matches = rankMatches(sourceProfile, sameTemplateCandidates);
    let semanticMatches = semanticMatchV2(sourceProfile, sameTemplateCandidates);
    const warnings =
      relationCase.embeddingStatus === "stale" || relationCase.embeddingStatus === "processing"
        ? ["Analyse semantique en cours d'actualisation"]
        : [];

    if (process.env.AI_TEST_MODE !== "scenario") {
      try {
        const sourceVector = await getStoredCaseEmbedding(relationCase.id, "case_summary");
        const fallbackVector = deterministicEmbedding([
          ...sourceProfile.categories,
          ...sourceProfile.interests,
          ...sourceProfile.constraints,
          sourceProfile.location,
          sourceProfile.budget,
          sourceProfile.availability,
          sourceProfile.relationType,
        ].filter(Boolean).join(" "));
        const vectorRows = await semanticVectorSearch({
          sourceVector: sourceVector ?? fallbackVector,
          ownerId: owner.id,
          templateKey: relationCase.template?.key ?? null,
          excludeCaseId: relationCase.id,
        });
        const byId = new Map(sameTemplateCandidates.map((candidate) => [candidate.id, candidate]));
        const vectorCandidates = vectorRows
          .map((row) => byId.get(row.relationCaseId))
          .filter((candidate): candidate is (typeof sameTemplateCandidates)[number] => Boolean(candidate));
        const vectorMatches = semanticMatchV2(sourceProfile, vectorCandidates);
        if (vectorMatches.length > 0) semanticMatches = vectorMatches;
      } catch (error) {
        console.info("[matching] semantic vector search fallback", {
          reason: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_VECTOR_SEARCH_ERROR",
        });
      }
    }

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "mock",
        model: "deterministic-matching-v1",
        action: "matching_analysis",
        status: "success",
        promptVersion: "matching-v1",
        outputSummary: `${matches.length} correspondance(s) potentielle(s)`,
      },
    });

    await prisma.aIEvent.create({
      data: {
        caseId: relationCase.id,
        provider: "mock",
        model: "hybrid-semantic-matching-v2",
        action: "semantic_matching_analysis",
        status: "success",
        promptVersion: "semantic-matching-v2",
        outputSummary: `${semanticMatches.length} correspondance(s) semantique(s)`,
      },
    });

    return NextResponse.json({ profile: sourceProfile, matches, semanticMatches, warnings });
  } catch (error) {
    console.error("[matching] Unable to analyze", error);
    return NextResponse.json({ error: "Impossible d'analyser les correspondances" }, { status: 500 });
  }
}
