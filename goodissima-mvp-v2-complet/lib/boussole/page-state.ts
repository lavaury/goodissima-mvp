import type { BoussolePageState } from "./contracts.ts";

export function resolveBoussolePageState({
  focusedObjectId,
  visibleObjectCount,
}: {
  focusedObjectId?: string | null;
  visibleObjectCount: number;
}): BoussolePageState {
  if (focusedObjectId) return "FOCUSED";
  return visibleObjectCount > 0 ? "POPULATED" : "EMPTY";
}
