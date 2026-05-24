import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const feedbackTypes = new Set(["Bug", "Suggestion", "UX", "Compréhension", "Autre"]);

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();
  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Feedback invalide" }, { status: 400 });
  }

  const type = feedbackTypes.has(String((body as { type?: unknown }).type))
    ? String((body as { type?: unknown }).type)
    : "Autre";
  const message = cleanString((body as { message?: unknown }).message, 800);

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
  const now = new Date();
  const feedback = {
    id: crypto.randomUUID(),
    type,
    message,
    page: cleanString((body as { page?: unknown }).page, 300),
    role: appUser?.role ?? (authUser?.email ? "AUTHENTICATED" : "VISITOR"),
    userId: appUser?.id ?? null,
    caseId: cleanString((body as { caseId?: unknown }).caseId, 120),
    templateId: cleanString((body as { templateId?: unknown }).templateId, 120),
    clientTimestamp: cleanString((body as { timestamp?: unknown }).timestamp, 80),
    serverTimestamp: now.toISOString(),
  };

  const feedbackDir = path.join(process.cwd(), ".feedback");
  await mkdir(feedbackDir, { recursive: true });
  await appendFile(path.join(feedbackDir, "feedback.jsonl"), `${JSON.stringify(feedback)}\n`, "utf8");

  console.info("[feedback]", { id: feedback.id, type: feedback.type, role: feedback.role });

  return NextResponse.json({ ok: true, id: feedback.id });
}
