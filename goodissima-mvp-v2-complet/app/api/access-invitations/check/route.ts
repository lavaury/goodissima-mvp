import { NextResponse } from "next/server";
import {
  getAccessInvitationDecision,
  getPrivateAccessModeEnv,
  isPrivateAccessMode,
  normalizeInvitationEmail,
} from "@/lib/access-invitations";

function logDecision(email: string, decision: Awaited<ReturnType<typeof getAccessInvitationDecision>>) {
  console.info("[access-invitations/check]", {
    email,
    privateAccessMode: decision.privateAccessMode,
    allowed: decision.allowed,
    reason: decision.reason,
    userExists: decision.userExists,
    invitationStatus: decision.invitationStatus,
    invitationExpiresAt: decision.invitationExpiresAt,
  });
}

export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const email = normalizeInvitationEmail(requestUrl.searchParams.get("email") ?? "");

  if (email) {
    const decision = await getAccessInvitationDecision(email);
    logDecision(email, decision);
    return NextResponse.json({
      ...decision,
      envValue: getPrivateAccessModeEnv(),
      envName: process.env.PRIVATE_ACCESS_MODE
        ? "PRIVATE_ACCESS_MODE"
        : process.env.PRIVATE_ACCES_MODE
          ? "PRIVATE_ACCES_MODE"
          : null,
    });
  }

  return NextResponse.json({
    privateAccessMode: isPrivateAccessMode(),
    envValue: getPrivateAccessModeEnv(),
    envName: process.env.PRIVATE_ACCESS_MODE
      ? "PRIVATE_ACCESS_MODE"
      : process.env.PRIVATE_ACCES_MODE
        ? "PRIVATE_ACCES_MODE"
        : null,
    allowed: isPrivateAccessMode() ? false : true,
    reason: "Ajoutez ?email=... pour obtenir une decision complete.",
    userExists: null,
    invitationStatus: null,
    invitationExpiresAt: null,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? normalizeInvitationEmail(body.email) : "";

  if (!email) {
    return NextResponse.json({ allowed: false, reason: "Email requis." }, { status: 400 });
  }

  const decision = await getAccessInvitationDecision(email);

  logDecision(email, decision);

  return NextResponse.json(decision);
}
