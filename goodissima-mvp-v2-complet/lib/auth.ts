import { redirect } from "next/navigation";
import {
  acceptInvitationForEmail,
  assertSignupAllowed,
  isPrivateAccessMode,
  normalizeInvitationEmail,
} from "@/lib/access-invitations";
import { defaultNotificationPreferences } from "@/lib/privacy";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user?.email) {
    redirect("/login");
  }

  return user;
}

export async function getCurrentPrismaUser() {
  const user = await requireCurrentUser();
  const email = normalizeInvitationEmail(user.email!);
  const name = user.user_metadata?.name || email;

  const existingOwner = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingOwner && isPrivateAccessMode()) {
    const access = await assertSignupAllowed(email);

    if (!access.allowed) {
      redirect("/private-access");
    }
  }

  const owner = await prisma.$transaction(async (tx) => {
    const savedOwner = await tx.user.upsert({
      where: { email },
      update: { name },
      create: { email, name },
    });

    if (isPrivateAccessMode()) {
      await acceptInvitationForEmail(tx, email, email);
    }

    return savedOwner;
  });

  await prisma.userNotificationPreference.upsert({
    where: { userId: owner.id },
    create: {
      userId: owner.id,
      ...defaultNotificationPreferences,
    },
    update: {},
  });

  return owner;
}
