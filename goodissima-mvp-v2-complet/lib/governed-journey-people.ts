export const JOURNEY_PEOPLE_COMPACT_LIMIT = 5;

export type CanonicalJourneyPerson = { key: string; userId: string | null; invitationId: string | null; displayName: string; qualities: Array<"ORGANIZER" | "PARTICIPANT">; identityVerified: boolean };

// Goodissima actors are canonical by User.id; guests remain scoped to their invitation.
// A published Person profile is the preferred public label, then User.name/email.
export function projectCanonicalJourneyPeople(input: { organizer: { id: string; name: string }; participants: ReadonlyArray<{ id: string; inviteeUserId: string | null; displayName: string; inviteeUser?: { name: string | null; email: string } | null }>; publicNamesByUserId?: ReadonlyMap<string, string> }) {
  const people = new Map<string, CanonicalJourneyPerson>();
  people.set(`user:${input.organizer.id}`, { key: `user:${input.organizer.id}`, userId: input.organizer.id, invitationId: null, displayName: input.publicNamesByUserId?.get(input.organizer.id) ?? input.organizer.name, qualities: ["ORGANIZER"], identityVerified: true });
  for (const participant of input.participants) {
    const key = participant.inviteeUserId ? `user:${participant.inviteeUserId}` : `guest:${participant.id}`;
    const existing = people.get(key);
    if (existing) { if (!existing.qualities.includes("PARTICIPANT")) existing.qualities.push("PARTICIPANT"); if (!existing.invitationId) existing.invitationId = participant.id; continue; }
    const userName = participant.inviteeUserId ? input.publicNamesByUserId?.get(participant.inviteeUserId) ?? participant.inviteeUser?.name ?? participant.inviteeUser?.email : null;
    people.set(key, { key, userId: participant.inviteeUserId, invitationId: participant.id, displayName: userName ?? participant.displayName, qualities: ["PARTICIPANT"], identityVerified: Boolean(participant.inviteeUserId) });
  }
  return [...people.values()];
}

export function projectCompactJourneyPeople<Active, Pending>(
  active: readonly Active[],
  pending: readonly Pending[],
  limit = JOURNEY_PEOPLE_COMPACT_LIMIT,
) {
  const compactLimit = Math.max(0, Math.floor(limit));
  return {
    totalActive: active.length,
    totalPending: pending.length,
    totalPeople: active.length + pending.length,
    visibleActive: active.slice(0, compactLimit),
    remainingActive: active.slice(compactLimit),
    visiblePending: pending.slice(0, compactLimit),
    remainingPending: pending.slice(compactLimit),
    hasOverflow: active.length > compactLimit || pending.length > compactLimit,
  };
}
