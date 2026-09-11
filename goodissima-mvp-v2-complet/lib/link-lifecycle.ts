export const LINK_STATUSES = ["DRAFT", "ACTIVE", "DISABLED", "EXPIRED", "ARCHIVED"] as const;
export type LinkLifecycleStatus = (typeof LINK_STATUSES)[number];

export const LINK_STATUS_TRANSITIONS: Record<LinkLifecycleStatus, readonly LinkLifecycleStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["DISABLED", "EXPIRED", "ARCHIVED"],
  DISABLED: ["ACTIVE", "ARCHIVED"],
  EXPIRED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionLinkStatus(from: LinkLifecycleStatus, to: LinkLifecycleStatus) {
  return LINK_STATUS_TRANSITIONS[from].includes(to);
}

export function canPublishLink(link: { status: LinkLifecycleStatus; expiresAt: Date | null }, now: Date) {
  return canTransitionLinkStatus(link.status, "ACTIVE") && (!link.expiresAt || link.expiresAt.getTime() > now.getTime());
}
