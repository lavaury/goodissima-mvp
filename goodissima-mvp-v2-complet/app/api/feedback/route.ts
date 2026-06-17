import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  cleanFeedbackString,
  feedbackScreenshotBucketName,
  isAllowedFeedbackScreenshot,
  maxFeedbackScreenshotSizeBytes,
  maxFeedbackScreenshots,
  normalizeFeedbackType,
  sanitizeFeedbackFileName,
} from "@/lib/product-feedback";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const isLocalDevelopment = process.env.NODE_ENV !== "production";

function getEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function getViewport(value: unknown) {
  if (typeof value === "string") {
    try {
      return getViewport(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") return null;

  const width = (value as { width?: unknown }).width;
  const height = (value as { height?: unknown }).height;

  if (typeof width !== "number" || typeof height !== "number") return null;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  return {
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  };
}

async function keepLocalJsonlFallback(feedback: Record<string, unknown>) {
  const feedbackDir = path.join(process.cwd(), ".feedback");
  await mkdir(feedbackDir, { recursive: true });
  await appendFile(path.join(feedbackDir, "feedback.jsonl"), `${JSON.stringify(feedback)}\n`, "utf8");
}

async function parseFeedbackRequest(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const files = formData.getAll("screenshots").filter((item): item is File => item instanceof File && item.size > 0);

    return {
      body: Object.fromEntries(formData.entries()),
      files,
    };
  }

  return {
    body: await req.json().catch(() => null),
    files: [] as File[],
  };
}

async function storeFeedbackScreenshots(params: {
  feedbackId: string;
  files: File[];
}) {
  if (params.files.length === 0) return [];

  const supabase = createAdminClient();
  const attachments = [];

  for (const file of params.files) {
    const safeFileName = sanitizeFeedbackFileName(file.name || "capture-feedback.png");
    const storagePath = `feedback/${params.feedbackId}/${crypto.randomUUID()}-${safeFileName}`;
    const { error } = await supabase.storage.from(feedbackScreenshotBucketName).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(error.message || "Upload screenshot failed");
    }

    attachments.push({
      feedbackId: params.feedbackId,
      fileName: file.name || safeFileName,
      fileUrl: storagePath,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    });
  }

  if (attachments.length === 0) return [];

  await prisma.productFeedbackAttachment.createMany({ data: attachments });
  return attachments;
}

export async function POST(req: Request) {
  const { body, files } = await parseFeedbackRequest(req);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Feedback invalide" }, { status: 400 });
  }

  if (files.length > maxFeedbackScreenshots) {
    return NextResponse.json({ error: "Maximum 5 captures d'écran" }, { status: 400 });
  }

  for (const file of files) {
    if (file.size > maxFeedbackScreenshotSizeBytes) {
      return NextResponse.json({ error: "Capture trop volumineuse: 10 Mo maximum" }, { status: 413 });
    }

    if (!isAllowedFeedbackScreenshot(file)) {
      return NextResponse.json({ error: "Format de capture non supporté" }, { status: 415 });
    }
  }

  const type = normalizeFeedbackType((body as { type?: unknown }).type);
  const message = cleanFeedbackString((body as { message?: unknown }).message, 800);

  if (!message || message.length < 4) {
    return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  }

  const authUser = await getCurrentUser().catch(() => null);
  const appUser = authUser?.email
    ? await prisma.user.findUnique({
        where: { email: authUser.email },
        select: { id: true, role: true },
      })
    : null;
  const caseId = cleanFeedbackString((body as { caseId?: unknown }).caseId, 120);
  const templateId = cleanFeedbackString((body as { templateId?: unknown }).templateId, 120);
  const [caseExists, templateExists] = await Promise.all([
    caseId ? prisma.relationCase.findUnique({ where: { id: caseId }, select: { id: true } }) : null,
    templateId ? prisma.relationTemplate.findUnique({ where: { id: templateId }, select: { id: true } }) : null,
  ]);

  const feedback = {
    type,
    message,
    page: cleanFeedbackString((body as { page?: unknown }).page, 300),
    role: appUser?.role ?? (authUser?.email ? "AUTHENTICATED" : "VISITOR"),
    userId: appUser?.id ?? null,
    caseId: caseExists?.id ?? null,
    templateId: templateExists?.id ?? null,
    browserInfo: {
      userAgent: cleanFeedbackString(req.headers.get("user-agent"), 500),
      language:
        cleanFeedbackString((body as { browserLanguage?: unknown }).browserLanguage, 80) ??
        cleanFeedbackString(req.headers.get("accept-language"), 160),
      viewport: getViewport((body as { viewport?: unknown }).viewport),
      clientTimestamp: cleanFeedbackString((body as { timestamp?: unknown }).timestamp, 80),
      contextAttached: String((body as { includePageContext?: unknown }).includePageContext) === "true",
      opportunityId: cleanFeedbackString((body as { opportunityId?: unknown }).opportunityId, 120),
    },
    environment: getEnvironment(),
  };

  try {
    const feedbackId = crypto.randomUUID();
    const saved = await prisma.productFeedback.create({
      data: { id: feedbackId, ...feedback },
      select: { id: true, type: true, role: true },
    });
    const attachments = await storeFeedbackScreenshots({ feedbackId: saved.id, files });
    console.info("[feedback]", {
      id: saved.id,
      type: saved.type,
      role: saved.role,
      storage: "database",
      attachments: attachments.length,
    });
  } catch (error) {
    console.error("[feedback] database persistence failed", error);

    if (!isLocalDevelopment || files.length > 0) {
      return NextResponse.json({ error: "Feedback indisponible" }, { status: 500 });
    }

    const fallback = { id: crypto.randomUUID(), ...feedback, serverTimestamp: new Date().toISOString() };
    await keepLocalJsonlFallback(fallback);
    console.info("[feedback]", { id: fallback.id, type: fallback.type, role: fallback.role, storage: "jsonl-fallback" });
  }

  return NextResponse.json({ ok: true });
}
