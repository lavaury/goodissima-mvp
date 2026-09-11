export function canSubmitToGLink(
  link: { status: string; expiresAt: Date | null },
  now: Date,
) {
  return link.status === "ACTIVE" && (!link.expiresAt || link.expiresAt.getTime() > now.getTime());
}
