import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { buildAIRelationContext, hasEnoughContextForAISummary } from "@/lib/ai/context";
import { summarizeRelationWithAI } from "@/lib/ai/service";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const relationCase = await prisma.relationCase.findFirst({
      where: { id: params.caseId, ownerId: owner.id },
      select: {
        id: true,
        status: true,
        currentStep: true,
        gLink: { select: { title: true } },
        template: {
          select: {
            key: true,
            name: true,
            status: true,
            aiInstructions: true,
            formTemplates: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: {
                fields: {
                  orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }],
                  select: { step: true, label: true },
                },
              },
            },
          },
        },
        relationActions: {
          orderBy: { createdAt: "desc" },
          select: { type: true, status: true, title: true, description: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { senderType: true, body: true, createdAt: true },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { fileName: true, mimeType: true },
        },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const context = buildAIRelationContext(relationCase);

    if (!hasEnoughContextForAISummary(context)) {
      return NextResponse.json(
        { error: "INSUFFICIENT_CONTEXT", message: "Pas assez de contenu pour une analyse IA pertinente." },
        { status: 422 },
      );
    }

    const result = await summarizeRelationWithAI({ caseId: relationCase.id, context });

    return NextResponse.json({
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
      summary: result.summary,
    });
  } catch (error) {
    console.error("[ai] Unable to summarize relation", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_ERROR",
    });
    return NextResponse.json({ error: "Unable to summarize relation" }, { status: 500 });
  }
}
