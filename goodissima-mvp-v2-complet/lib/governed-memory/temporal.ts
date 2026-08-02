import type { GovernedMemoryAccessGrant, GovernedMemoryTemporal } from "./types";

export function parseInstant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function wasKnownAt(recordedAt: string, at: string): boolean {
  const recorded = parseInstant(recordedAt);
  const reference = parseInstant(at);
  return recorded !== null && reference !== null && recorded <= reference;
}

export function wasEffectiveAt(element: Pick<GovernedMemoryTemporal, "effectiveFrom" | "effectiveUntil">, at: string): boolean {
  const from = parseInstant(element.effectiveFrom);
  const until = element.effectiveUntil === null ? null : parseInstant(element.effectiveUntil);
  const reference = parseInstant(at);
  return from !== null && reference !== null && from <= reference && (until === null || reference < until);
}

export function wasAccessibleAt(grant: GovernedMemoryAccessGrant, at: string): boolean {
  const reference = parseInstant(at);
  const from = parseInstant(grant.effectiveFrom);
  const until = grant.effectiveUntil === null ? null : parseInstant(grant.effectiveUntil);
  const revoked = grant.revokedAt === null ? null : parseInstant(grant.revokedAt);
  return reference !== null && from !== null && from <= reference && (until === null || reference < until) && (revoked === null || reference < revoked);
}

export function isTemporallyValid(element: GovernedMemoryTemporal, now: string): boolean {
  const recorded = parseInstant(element.recordedAt);
  const current = parseInstant(now);
  const from = parseInstant(element.effectiveFrom);
  const until = element.effectiveUntil === null ? null : parseInstant(element.effectiveUntil);
  const superseded = element.supersededAt == null ? null : parseInstant(element.supersededAt);
  return recorded !== null && current !== null && from !== null && recorded <= current && (until === null || until > from) && (superseded === null || superseded >= recorded);
}

export function selectStateAt<T extends GovernedMemoryTemporal>(elements: readonly T[], at: string): T[] {
  return elements.filter((element) => wasKnownAt(element.recordedAt, at) && wasEffectiveAt(element, at) && (element.supersededAt == null || !wasKnownAt(element.supersededAt, at)));
}
