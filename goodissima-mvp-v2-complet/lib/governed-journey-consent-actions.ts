"use server";

import { redirect } from "next/navigation";
import { normalizeInvitationEmail } from "@/lib/access-invitations";
import { getCurrentUser } from "@/lib/auth";
import { decideJourneyInvitation } from "@/lib/governed-journey-consent";
import { prisma } from "@/lib/prisma";

function tokenFromForm(formData: FormData) {
  const value = formData.get("invitationToken");
  if (typeof value !== "string" || !value) throw new Error("Invitation indisponible.");
  return value;
}

async function decide(formData: FormData, decision: "ACCEPTED" | "DECLINED") {
  const token = tokenFromForm(formData);
  const authUser = await getCurrentUser();
  const user = authUser?.email ? await prisma.user.findUnique({ where: { email: normalizeInvitationEmail(authUser.email) }, select: { id: true } }) : null;
  try {
    await decideJourneyInvitation(prisma, { token, userId: user?.id ?? null, decision });
    redirect(`/gouvernance/invitation/${encodeURIComponent(token)}?decision=${decision.toLowerCase()}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(`/gouvernance/invitation/${encodeURIComponent(token)}?decision=unavailable`);
  }
}

export async function acceptJourneyInvitation(formData: FormData) {
  return decide(formData, "ACCEPTED");
}

export async function declineJourneyInvitation(formData: FormData) {
  return decide(formData, "DECLINED");
}
