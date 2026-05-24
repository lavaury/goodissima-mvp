import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { defaultNotificationPreferences } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";

const frequencies = new Set(["IMMEDIATE", "DAILY", "WEEKLY"]);

export async function PUT(req: Request) {
  const owner = await getCurrentPrismaUser();
  const body = await req.json();

  const preferences = {
    emailNotificationsEnabled: Boolean(body.emailNotificationsEnabled),
    newMessagesEnabled: Boolean(body.newMessagesEnabled),
    newRequestsEnabled: Boolean(body.newRequestsEnabled),
    newDocumentsEnabled: Boolean(body.newDocumentsEnabled),
    validationsEnabled: Boolean(body.validationsEnabled),
    relationalPrivacyEnabled: body.relationalPrivacyEnabled !== false,
    pseudonymizationEnabled: body.pseudonymizationEnabled !== false,
    frequency: typeof body.frequency === "string" && frequencies.has(body.frequency) ? body.frequency : "IMMEDIATE",
  };

  const saved = await prisma.userNotificationPreference.upsert({
    where: { userId: owner.id },
    create: {
      userId: owner.id,
      ...preferences,
    },
    update: preferences,
  });

  return NextResponse.json(saved);
}

export async function GET() {
  const owner = await getCurrentPrismaUser();
  const preferences = await prisma.userNotificationPreference.findUnique({
    where: { userId: owner.id },
  });

  return NextResponse.json(preferences ?? defaultNotificationPreferences);
}
