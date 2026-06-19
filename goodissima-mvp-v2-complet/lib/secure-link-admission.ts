export type SecureLinkAdmissionMode = "OPEN" | "VERIFIED_ONLY";

export const DEFAULT_SECURE_LINK_ADMISSION_MODE: SecureLinkAdmissionMode = "OPEN";

export const SECURE_LINK_ADMISSION_LABELS: Record<SecureLinkAdmissionMode, string> = {
  OPEN: "Ouverte à tous",
  VERIFIED_ONLY: "Réservée aux personnes vérifiées",
};

export function parseSecureLinkAdmissionMode(value: unknown): SecureLinkAdmissionMode {
  return value === "VERIFIED_ONLY" ? "VERIFIED_ONLY" : DEFAULT_SECURE_LINK_ADMISSION_MODE;
}

export function canSubmitToSecureLink(input: {
  mode: SecureLinkAdmissionMode;
  hasVerifiedIdentity: boolean;
}) {
  return input.mode === "OPEN" || input.hasVerifiedIdentity;
}
