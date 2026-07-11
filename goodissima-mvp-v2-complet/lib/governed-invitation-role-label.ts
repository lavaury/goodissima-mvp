export function getGovernedInvitationRoleLabel(role: string, metadata?: unknown) {
  const row = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  const businessRole = typeof row.participantRole === "string" && row.participantRole.trim() ? row.participantRole.trim() : null;
  if (businessRole) return businessRole.split(/[_-]+/).map((part) => part ? part[0].toLocaleUpperCase("fr") + part.slice(1).toLocaleLowerCase("fr") : "").join(" ");
  return ({ EXPERT: "Expert", JUDGE: "Juge", THIRD_PARTY: "Tiers", ASSOCIATION: "Association", FAMILY: "Famille", OBSERVER: "Observateur", OTHER: "Participant invité" } as Record<string, string>)[role] ?? "Participant invité";
}
