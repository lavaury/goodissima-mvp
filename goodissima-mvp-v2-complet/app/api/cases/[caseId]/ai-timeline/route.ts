import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { analyzeTimelineWithAI } from "@/lib/ai/service";
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

function daysSince(date: Date | null) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
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
        createdAt: true,
        gLink: { select: { title: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { senderType: true, body: true, createdAt: true },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { fileName: true, mimeType: true, createdAt: true },
        },
        relationActions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { type: true, status: true, title: true, description: true, createdAt: true, completedAt: true },
        },
      },
    });

    if (!relationCase) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }

    const lastMessage = relationCase.messages.at(-1);
    const lastActivityDates = [
      relationCase.createdAt,
      ...relationCase.messages.map((message) => message.createdAt),
      ...relationCase.documents.map((document) => document.createdAt),
      ...relationCase.relationActions.map((action) => action.completedAt ?? action.createdAt),
    ];
    const lastActivityAt = new Date(Math.max(...lastActivityDates.map((date) => date.getTime())));

    const context = {
      title: sanitizeText(relationCase.gLink.title, 240),
      status: relationCase.status,
      currentStep: relationCase.currentStep,
      createdAt: relationCase.createdAt.toISOString(),
      lastActivityAt: lastActivityAt.toISOString(),
      inactiveSinceDays: daysSince(lastActivityAt),
      lastMessageAuthor:
        lastMessage?.senderType === "OWNER" ? "owner" : lastMessage?.senderType === "SYSTEM" ? "system" : "contact",
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
        completedAt: action.completedAt?.toISOString() ?? null,
      })),
    };

    const result = await analyzeTimelineWithAI({ caseId: relationCase.id, context });

    return NextResponse.json({
      provider: result.provider,
      model: result.model,
      promptVersion: result.promptVersion,
      timeline: result.timeline,
    });
  } catch (error) {
    console.error("[ai] Unable to analyze timeline", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_TIMELINE_ERROR",
    });
    return NextResponse.json({ error: "Impossible d'analyser la timeline" }, { status: 500 });
  }
}
