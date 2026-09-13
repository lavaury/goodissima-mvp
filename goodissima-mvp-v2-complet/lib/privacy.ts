export type NotificationKind = "messages" | "requests" | "documents" | "validations";

export const defaultNotificationPreferences = {
  emailNotificationsEnabled: true,
  newMessagesEnabled: true,
  newRequestsEnabled: true,
  newDocumentsEnabled: true,
  validationsEnabled: true,
  relationalPrivacyEnabled: true,
  pseudonymizationEnabled: true,
  frequency: "IMMEDIATE",
};

type NotificationPreferences = {
  emailNotificationsEnabled: boolean;
  newMessagesEnabled: boolean;
  newRequestsEnabled: boolean;
  newDocumentsEnabled: boolean;
  validationsEnabled: boolean;
  frequency?: string;
} | null | undefined;

export function resolveNotificationPreferences(preferences: NotificationPreferences) {
  return preferences ?? defaultNotificationPreferences;
}

export function getRelationIdentity(params: {
  name?: string | null;
  pseudonym?: string | null;
  organization?: string | null;
  role?: string | null;
}) {
  return params.name?.trim() || params.pseudonym?.trim() || params.organization?.trim() || params.role?.trim() || "Contact";
}

export function redactEmail(value: string | null | undefined) {
  if (!value) return null;

  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) return "[private-email]";

  return `${localPart.slice(0, 1)}***@${domain}`;
}

export function isNotificationEnabled(
  preferences: NotificationPreferences,
  kind: NotificationKind,
) {
  const resolved = resolveNotificationPreferences(preferences);
  if (!resolved.emailNotificationsEnabled) return false;

  if (kind === "messages") return resolved.newMessagesEnabled;
  if (kind === "requests") return resolved.newRequestsEnabled;
  if (kind === "documents") return resolved.newDocumentsEnabled;
  if (kind === "validations") return resolved.validationsEnabled;

  return false;
}

export function logNotificationSkipped(
  preferences: NotificationPreferences,
  kind: NotificationKind,
  context: Record<string, unknown>,
) {
  const reason = !preferences
    ? "missing_preferences"
    : !preferences.emailNotificationsEnabled
      ? "email_notifications_disabled"
      : `${kind}_disabled`;

  console.info("[owner-email] Notification skipped by owner preferences", {
    kind,
    reason,
    emailNotificationsEnabled: preferences?.emailNotificationsEnabled ?? null,
    newMessagesEnabled: preferences?.newMessagesEnabled ?? null,
    newRequestsEnabled: preferences?.newRequestsEnabled ?? null,
    newDocumentsEnabled: preferences?.newDocumentsEnabled ?? null,
    validationsEnabled: preferences?.validationsEnabled ?? null,
    ...context,
  });
}
