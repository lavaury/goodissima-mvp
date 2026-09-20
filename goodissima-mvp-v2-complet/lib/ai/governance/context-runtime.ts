import "server-only";
import { getCurrentPrismaUser } from "@/lib/auth";
import { GovernedMemoryAIContextService } from "@/lib/ai/governance/context";
import { PrismaGovernedMemoryAIContextRepository } from "@/lib/ai/governance/context-repository";
import type { AICapabilityId } from "@/lib/ai/governance/types";

/** Authenticated, one-execution entry point. Actor identity is resolved server-side and never accepted from the client. */
export async function buildGovernedJourneyAuthorizedAIContext(input: { journeyId: string; capability: AICapabilityId }) {
  const actor = await getCurrentPrismaUser();
  return new GovernedMemoryAIContextService(new PrismaGovernedMemoryAIContextRepository()).build({
    journeyId: input.journeyId,
    actorId: actor.id,
    capability: input.capability,
  });
}
