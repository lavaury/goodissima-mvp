export type NotificationKind = "messages" | "requests" | "documents" | "validations";

export const defaultNotificationPreferences = {
  emailNotificationsEnabled: false,
  newMessagesEnabled: false,
  newRequestsEnabled: false,
  newDocumentsEnabled: false,
  validationsEnabled: false,
  relationalPrivacyEnabled: true,
  pseudonymizationEnabled: true,
  frequency: "IMMEDIATE",
};

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
  preferences:
    | {
        emailNotificationsEnabled: boolean;
        newMessagesEnabled: boolean;
        newRequestsEnabled: boolean;
        newDocumentsEnabled: boolean;
        validationsEnabled: boolean;
      }
    | null
    | undefined,
  kind: NotificationKind,
) {
  if (!preferences?.emailNotificationsEnabled) return false;

  if (kind === "messages") return preferences.newMessagesEnabled;
  if (kind === "requests") return preferences.newRequestsEnabled;
  if (kind === "documents") return preferences.newDocumentsEnabled;
  if (kind === "validations") return preferences.validationsEnabled;

  return false;
}
