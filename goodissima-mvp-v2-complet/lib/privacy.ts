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
} | null | undefined;

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
  if (!preferences?.emailNotificationsEnabled) return false;

  if (kind === "messages") return preferences.newMessagesEnabled;
  if (kind === "requests") return preferences.newRequestsEnabled;
  if (kind === "documents") return preferences.newDocumentsEnabled;
  if (kind === "validations") return preferences.validationsEnabled;

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
