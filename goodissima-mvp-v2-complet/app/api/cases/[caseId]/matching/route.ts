import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { extractMatchingProfile, rankMatches } from "@/lib/ai/matching";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: {
        id: true,
        matchingEnabled: true,
        candidateName: true,
        gLink: { select: { title: true } },
        template: { select: { key: true, name: true, aiInstructions: true } },
        messages: { orderBy: { createdAt: "asc" }, take: 20, select: { body: true } },
        documents: { orderBy: { createdAt: "desc" }, take: 10, select: { fileName: true } },
      },
    });

    if (!relationCase) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    if (!relationCase.matchingEnabled) {
      return NextResponse.json({ error: "MATCHING_DISABLED" }, { status: 409 });
    }

    const sourceProfile = extractMatchingProfile({
      templateKey: relationCase.template?.key,
      templateName: relationCase.template?.name,
      title: relationCase.gLink.title,
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
        gLink: { select: { title: true } },
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
        profile: extractMatchingProfile({
          templateKey: candidate.template?.key,
          templateName: candidate.template?.name,
          title: candidate.gLink.title,
          messages: candidate.messages.map((message) => message.body),
          documents: candidate.documents.map((document) => document.fileName),
          aiInstructions: candidate.template?.aiInstructions,
        }),
      }));

    const matches = rankMatches(sourceProfile, sameTemplateCandidates);

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

    return NextResponse.json({ profile: sourceProfile, matches });
  } catch (error) {
    console.error("[matching] Unable to analyze", error);
    return NextResponse.json({ error: "Impossible d'analyser les correspondances" }, { status: 500 });
  }
}
