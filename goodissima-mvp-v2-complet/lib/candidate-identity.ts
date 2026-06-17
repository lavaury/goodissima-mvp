export type CandidateIdentityStatus =
  | "Identifié"
  | "Partiellement identifié"
  | "Non identifié"
  | "Vérification requise";

export type CandidateIdentityState = {
  displayName: string;
  displayEmail: string;
  status: CandidateIdentityStatus;
  hasName: boolean;
  hasEmail: boolean;
  isMissingIdentity: boolean;
  recommendation?: string;
};

export const candidateIdentityRequestTitle = "Demander les coordonnées";
export const candidateIdentityRecommendation = "Demander l’identification du candidat.";

const syntheticEmailPattern = /^private-[^@\s]+@goodissima\.local$/i;
const syntheticNamePattern = /^candidat goodissima$/i;

export function isSyntheticCandidateEmail(value: string | null | undefined) {
  return Boolean(value?.trim() && syntheticEmailPattern.test(value.trim()));
}

export function isSyntheticCandidateName(value: string | null | undefined) {
  return Boolean(value?.trim() && syntheticNamePattern.test(value.trim()));
}

function shortCandidateId(id: string | null | undefined) {
  const normalized = id?.replace(/[^a-z0-9]/gi, "").slice(-6);
  return normalized ? normalized.toUpperCase() : null;
}

export function resolveCandidateIdentityState(input: {
  id?: string | null;
  candidateName?: string | null;
  candidateEmail?: string | null;
  identityVerificationStatus?: string | null;
}): CandidateIdentityState {
  const name = input.candidateName?.trim() ?? "";
  const email = input.candidateEmail?.trim() ?? "";
  const hasName = Boolean(name) && !isSyntheticCandidateName(name);
  const hasEmail = Boolean(email) && !isSyntheticCandidateEmail(email);
  const shortId = shortCandidateId(input.id);
  const displayName = hasName ? name : shortId ? `Candidat #${shortId}` : "Candidat non identifié";
  const displayEmail = hasEmail ? email : "Contact non renseigné";

  let status: CandidateIdentityStatus;
  if (input.identityVerificationStatus === "SUSPENDED") {
    status = "Vérification requise";
  } else if (hasName && hasEmail) {
    status = "Identifié";
  } else if (hasName || hasEmail) {
    status = "Partiellement identifié";
  } else {
    status = "Non identifié";
  }

  const isMissingIdentity = !hasName || !hasEmail;

  return {
    displayName,
    displayEmail,
    status,
    hasName,
    hasEmail,
    isMissingIdentity,
    recommendation: isMissingIdentity ? candidateIdentityRecommendation : undefined,
  };
}
