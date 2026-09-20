import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GovernedMemoryMutationService, type MemoryMutationInput, type MemoryMutationResult } from "./mutation-service";
import { PrismaGovernedMemoryMutationRepository } from "./prisma-mutation-repository";

export async function executeJourneyMemoryMutation(input: MemoryMutationInput): Promise<MemoryMutationResult> {
  const authUser = await getCurrentUser().catch(() => null);
  if (!authUser?.email) throw new Error("MEMORY_NOT_FOUND");
  const user = await prisma.user.findUnique({ where: { email: authUser.email.trim().toLowerCase() }, select: { id: true } });
  if (!user) throw new Error("MEMORY_NOT_FOUND");
  return new GovernedMemoryMutationService(new PrismaGovernedMemoryMutationRepository()).executeHuman(user.id, input);
}
