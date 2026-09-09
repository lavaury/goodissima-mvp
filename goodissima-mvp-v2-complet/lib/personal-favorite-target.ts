import type { FavoriteObjectKind } from "@prisma/client";

export type FavoriteTarget = { objectKind: FavoriteObjectKind; objectId: string };
const kinds = new Set(["PORTFOLIO", "WORKSPACE", "GLINK", "RELATION_TEMPLATE", "RELATION_CASE"]);
export function favoriteObjectId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/.test(value);
}
export function favoriteTarget(value: unknown): FavoriteTarget | null {
  if (!value || typeof value !== "object") return null;
  const { objectKind, objectId } = value as Record<string, unknown>;
  return typeof objectKind === "string" && kinds.has(objectKind) && favoriteObjectId(objectId)
    ? { objectKind: objectKind as FavoriteObjectKind, objectId } : null;
}
export function favoriteKey(target: FavoriteTarget) {
  return JSON.stringify([target.objectKind, target.objectId]);
}
export function favoritePage(value: unknown): number {
  const page = typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : value;
  return typeof page === "number" && Number.isInteger(page) && page >= 0 && page <= 1000 ? page : 0;
}
