export type CanonicalCaseCandidate = {
  id: string;
  createdAt: Date;
  candidateAccessRevokedAt: Date | null;
  candidateAccessExpiresAt: Date | null;
  messages: Array<{ createdAt: Date }>;
};

export function pickCanonicalRelationCaseId(cases: CanonicalCaseCandidate[], now = new Date()) {
  return [...cases].sort((left, right) => {
    const leftMessage = left.messages[0]?.createdAt?.getTime() ?? 0;
    const rightMessage = right.messages[0]?.createdAt?.getTime() ?? 0;
    if (Boolean(leftMessage) !== Boolean(rightMessage)) return Number(Boolean(rightMessage)) - Number(Boolean(leftMessage));
    if (leftMessage !== rightMessage) return rightMessage - leftMessage;
    const active = (item: CanonicalCaseCandidate) => !item.candidateAccessRevokedAt && (!item.candidateAccessExpiresAt || item.candidateAccessExpiresAt > now);
    if (active(left) !== active(right)) return Number(active(right)) - Number(active(left));
    return right.createdAt.getTime() - left.createdAt.getTime();
  })[0]?.id ?? null;
}
