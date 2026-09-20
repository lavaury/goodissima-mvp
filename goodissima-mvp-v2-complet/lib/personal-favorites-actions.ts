"use server";

import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { favoriteTarget } from "@/lib/personal-favorite-target";
import { readFavoritePage, resolveFavorites } from "@/lib/personal-favorites-repository";

export async function listFavorites(page?: unknown) {
  noStore();
  const user = await getCurrentPrismaUser();
  return readFavoritePage(user.id, page);
}

export async function getFavoriteState(input: unknown) {
  noStore();
  const user = await getCurrentPrismaUser();
  const target = favoriteTarget(input);
  if (!target || !(await resolveFavorites(user.id, [target])).length) return { available: false, saved: false };
  const saved = await prisma.personalFavorite.findUnique({
    where: { userId_objectKind_objectId: { userId: user.id, ...target } }, select: { objectId: true },
  });
  return { available: true, saved: Boolean(saved) };
}

export async function addFavorite(input: unknown) {
  const user = await getCurrentPrismaUser();
  const target = favoriteTarget(input);
  if (!target || !(await resolveFavorites(user.id, [target])).length) return { ok: false };
  // ON CONFLICT DO NOTHING: concurrent adds are idempotent; createdAt is stable.
  await prisma.personalFavorite.createMany({ data: [{ userId: user.id, ...target }], skipDuplicates: true });
  revalidatePath("/favoris");
  return { ok: true };
}

export async function removeFavorite(input: unknown) {
  const user = await getCurrentPrismaUser();
  const target = favoriteTarget(input);
  if (!target) return { ok: false };
  // Removing one's reference does not require access to the target object.
  await prisma.personalFavorite.deleteMany({ where: { userId: user.id, ...target } });
  revalidatePath("/favoris");
  return { ok: true };
}
