import { rankMatches } from "@/lib/ai/matching";
import { semanticMatchV2 } from "@/lib/ai/semantic-matching";
import type { GLinkMatchingEngines } from "@/lib/matching/matching-execution-service";

export const glinkMatchingEngines: GLinkMatchingEngines = {
  lexical: rankMatches,
  semantic: semanticMatchV2,
};
