import { NextResponse } from "next/server";
import { assertSignupAllowed, normalizeInvitationEmail } from "@/lib/access-invitations";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? normalizeInvitationEmail(body.email) : "";

  if (!email) {
    return NextResponse.json({ allowed: false, reason: "Email requis." }, { status: 400 });
  }

  const result = await assertSignupAllowed(email);

  if (!result.allowed) {
    return NextResponse.json({ allowed: false, reason: result.reason }, { status: 403 });
  }

  return NextResponse.json({ allowed: true });
}
