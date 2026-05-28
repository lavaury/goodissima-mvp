import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { analyzeRiskSignalsWithAI } from "@/lib/ai/service";
import { prisma } from "@/lib/prisma";

const emailPattern = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const urlPattern = /https?:\/\/[^\s]+/g;
const tokenPattern = /\b[A-Za-z0-9_-]{24,}\b/g;

function sanitizeText(value: string, maxLength = 1200) {
  return value
    .replace(emailPattern, "[private-email]")
    .replace(urlPattern, "[private-url]")
    .replace(tokenPattern, "[private-token]")
    .slice(0, maxLength);
}

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
        template: { select: { key: true, name: true, status: true, aiInstructions: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 12,
          select: { senderType: true, body: true, createdAt: true },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { fileName: true, mimeType: true, createdAt: true },
        },
        relationActions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { type: true, status: true, title: true, description: true, createdAt: true },
        },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    const context = {
      title: sanitizeText(relationCase.gLink.title, 240),
      template: {
        key: relationCase.template?.key ?? null,
        name: relationCase.template?.name ?? null,
        status: relationCase.template?.status ?? null,
        aiInstructions: relationCase.template?.aiInstructions
          ? sanitizeText(relationCase.template.aiInstructions, 800)
          : null,
      },
      status: relationCase.status,
      currentStep: relationCase.currentStep,
      recentMessages: relationCase.messages.slice(-8).map((message) => ({
        author: message.senderType === "OWNER" ? "owner" : message.senderType === "SYSTEM" ? "system" : "contact",
        body: sanitizeText(message.body),
        createdAt: message.createdAt.toISOString(),
      })),
      documents: relationCase.documents.map((document) => ({
        fileName: sanitizeText(document.fileName, 240),
        mimeType: document.mimeType,
        createdAt: document.createdAt.toISOString(),
      })),
      actions: relationCase.relationActions.map((action) => ({
        type: action.type,
        status: action.status,
        title: sanitizeText(action.title, 240),
        description: action.description ? sanitizeText(action.description, 600) : null,
        createdAt: action.createdAt.toISOString(),
      })),
    };

    const result = await analyzeRiskSignalsWithAI({ caseId: relationCase.id, context });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ai] Unable to analyze risk signals", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_RISK_ERROR",
    });
    return NextResponse.json({ error: "Impossible d'analyser les signaux" }, { status: 500 });
  }
}
