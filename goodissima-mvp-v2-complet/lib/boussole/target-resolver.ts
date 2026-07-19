import type { CompassStep } from "../boussole-context.ts";

export function resolveNextTargetInSequence(
  steps: CompassStep[],
  currentIndex: number,
  targetExists: (targetId: string) => boolean,
) {
  return steps.slice(currentIndex + 1).find((step) => step.targetId && targetExists(step.targetId));
}
