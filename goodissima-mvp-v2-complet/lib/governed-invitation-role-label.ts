export function getGovernedInvitationRoleLabel(role: string, metadata?: unknown): string | null {
  const row = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  const businessRole = typeof row.participantRole === "string" && row.participantRole.trim() ? row.participantRole.trim() : null;
  if (businessRole && businessRole !== "Participant attendu" && businessRole !== "Participant invité") return businessRole;
  return ({ EXPERT: "Expert", JUDGE: "Juge", THIRD_PARTY: "Tiers", ASSOCIATION: "Association", FAMILY: "Famille", OBSERVER: "Observateur" } as Record<string, string>)[role] ?? null;
}
