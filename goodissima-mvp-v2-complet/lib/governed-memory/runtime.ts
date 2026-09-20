import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { JourneyMemoryProjection } from "./contracts";
import { PrismaGovernedMemoryReadRepository } from "./repository";
import { GovernedMemoryReadService } from "./service";

/** Authenticated server entry point. It performs reads only and returns a logical 404 on every access failure. */
export async function readJourneyGovernedMemory(journeyId: string): Promise<JourneyMemoryProjection | null> {
  const authUser = await getCurrentUser().catch(() => null);
  if (!authUser?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: authUser.email.trim().toLowerCase() }, select: { id: true } });
  if (!user) return null;
  return new GovernedMemoryReadService(new PrismaGovernedMemoryReadRepository()).readJourneyGovernedMemory(journeyId, user.id);
}
