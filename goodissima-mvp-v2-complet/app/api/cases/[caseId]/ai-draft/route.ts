import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { generateDraftWithAI } from "@/lib/ai/service";
import type { AIDraftType } from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";

const draftTypes = [
  "FOLLOW_UP",
  "DOCUMENT_REQUEST",
  "CLARIFICATION_REQUEST",
  "INVESTOR_REPLY",
  "PROFESSIONAL_RESPONSE",
] as const satisfies readonly AIDraftType[];

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

function isDraftType(value: unknown): value is AIDraftType {
  return typeof value === "string" && draftTypes.includes(value as AIDraftType);
}

export async function POST(req: Request, { params }: { params: { caseId: string } }) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const draftType = isDraftType(body.draftType) ? body.draftType : "PROFESSIONAL_RESPONSE";
    const instruction = typeof body.instruction === "string" ? sanitizeText(body.instruction, 800) : null;

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
      recentTimeline: [
        ...relationCase.messages.slice(-5).map((message) => ({
          type: "message",
          author: message.senderType === "OWNER" ? "owner" : message.senderType === "SYSTEM" ? "system" : "contact",
          createdAt: message.createdAt.toISOString(),
        })),
        ...relationCase.relationActions.slice(0, 5).map((action) => ({
          type: "action",
          actionType: action.type,
          status: action.status,
          title: sanitizeText(action.title, 240),
          createdAt: action.createdAt.toISOString(),
        })),
      ],
      documents: relationCase.documents.map((document) => ({
        fileName: sanitizeText(document.fileName, 240),
        mimeType: document.mimeType,
        createdAt: document.createdAt.toISOString(),
      })),
      openActions: relationCase.relationActions
        .filter((action) => action.status !== "COMPLETED")
        .map((action) => ({
          type: action.type,
          title: sanitizeText(action.title, 240),
          description: action.description ? sanitizeText(action.description, 600) : null,
        })),
    };

    const result = await generateDraftWithAI({
      caseId: relationCase.id,
      draftType,
      instruction,
      context,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ai] Unable to generate draft", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_AI_DRAFT_ERROR",
    });
    return NextResponse.json({ error: "Impossible de generer le brouillon" }, { status: 500 });
  }
}
