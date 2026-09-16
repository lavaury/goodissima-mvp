"use server";

import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { decideJourneyInvitation } from "@/lib/governed-journey-consent";
import { prisma } from "@/lib/prisma";

function tokenFromForm(formData: FormData) {
  const value = formData.get("invitationToken");
  if (typeof value !== "string" || !value) throw new Error("Invitation indisponible.");
  return value;
}

async function decide(formData: FormData, decision: "ACCEPTED" | "DECLINED") {
  const token = tokenFromForm(formData);
  const user = await getCurrentPrismaUser();
  try {
    await decideJourneyInvitation(prisma, { token, user, decision });
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
