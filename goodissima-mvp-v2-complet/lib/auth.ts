import { redirect } from "next/navigation";
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
  const email = user.email!;
  const name = user.user_metadata?.name || email;

  const owner = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, name },
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
