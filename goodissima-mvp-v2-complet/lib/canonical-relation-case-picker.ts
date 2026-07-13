export type CanonicalCaseCandidate = {
  id: string;
  createdAt: Date;
  candidateAccessRevokedAt: Date | null;
  candidateAccessExpiresAt: Date | null;
  messages: Array<{ createdAt: Date }>;
};

export function pickCanonicalRelationCaseId(cases: CanonicalCaseCandidate[], now = new Date()) {
  const activeCases = cases.filter(
    (item) =>
      !item.candidateAccessRevokedAt &&
      (!item.candidateAccessExpiresAt || item.candidateAccessExpiresAt > now),
  );

  // V1 safety rule: never infer a private conversation when several active
  // RelationCases are compatible, even if one happens to have newer messages.
  return activeCases.length === 1 ? activeCases[0].id : null;
}
