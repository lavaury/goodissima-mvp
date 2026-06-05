import type { TrustPolicy } from "@prisma/client";

export type TrustPolicyActorRole = "OWNER" | "CANDIDATE";

export type TrustPolicyAction = "READ" | "WRITE" | "UPLOAD_DOCUMENT";

export type TrustPolicyV1Policy = Pick<
  TrustPolicy,
  | "id"
  | "status"
  | "candidateCanRead"
  | "candidateCanWrite"
  | "ownerCanRead"
  | "ownerCanWrite"
  | "accessMode"
  | "requireCandidateEmail"
  | "requireCandidateConsent"
  | "allowDocuments"
  | "candidateTokenTtlDays"
  | "version"
>;

export type TrustPolicyEvaluationInput = {
  policy?: TrustPolicyV1Policy | null;
  actorRole: TrustPolicyActorRole;
  action: TrustPolicyAction;
  candidateEmail?: string | null;
  candidateConsent?: boolean | null;
};

export type TrustPolicyEvaluationResult = {
  allowed: boolean;
  reasons: string[];
  missingRequirements: string[];
};

export type AdmissionTrustPolicySource = "GLINK" | "TEMPLATE" | null;

export type AdmissionTrustPolicyResolution = {
  policy: TrustPolicyV1Policy | null;
  source: AdmissionTrustPolicySource;
};

export type AdmissionTrustPolicyEvaluationInput = {
  policy?: TrustPolicyV1Policy | null;
  candidateEmail?: string | null;
  candidateConsentAccepted?: boolean | null;
};

type TrustPolicyResolverClient = {
  trustPolicy: {
    findFirst: (args: {
      where: {
        relationCaseId?: string;
        gLinkId?: string;
        templateId?: string;
        scope: "RELATION_CASE" | "GLINK" | "TEMPLATE";
        status: { in: Array<"ACTIVE" | "DISABLED"> };
      };
      orderBy: { createdAt: "desc" };
      select: Record<keyof TrustPolicyV1Policy, true>;
    }) => Promise<TrustPolicyV1Policy | null>;
  };
};

const trustPolicyV1Select: Record<keyof TrustPolicyV1Policy, true> = {
  id: true,
  status: true,
  candidateCanRead: true,
  candidateCanWrite: true,
  ownerCanRead: true,
  ownerCanWrite: true,
  accessMode: true,
  requireCandidateEmail: true,
  requireCandidateConsent: true,
  allowDocuments: true,
  candidateTokenTtlDays: true,
  version: true,
};

export async function resolveRelationCaseTrustPolicy(
  prisma: TrustPolicyResolverClient,
  relationCaseId: string,
) {
  return prisma.trustPolicy.findFirst({
    where: {
      relationCaseId,
      scope: "RELATION_CASE",
      status: { in: ["ACTIVE", "DISABLED"] },
    },
    orderBy: { createdAt: "desc" },
    select: trustPolicyV1Select,
  });
}

export async function resolveAdmissionTrustPolicyForLink(
  prisma: TrustPolicyResolverClient,
  input: { gLinkId: string; templateId?: string | null },
): Promise<AdmissionTrustPolicyResolution> {
  const gLinkPolicy = await prisma.trustPolicy.findFirst({
    where: {
      gLinkId: input.gLinkId,
      scope: "GLINK",
      status: { in: ["ACTIVE", "DISABLED"] },
    },
    orderBy: { createdAt: "desc" },
    select: trustPolicyV1Select,
  });

  if (gLinkPolicy) {
    return { policy: gLinkPolicy, source: "GLINK" };
  }

  if (!input.templateId) {
    return { policy: null, source: null };
  }

  const templatePolicy = await prisma.trustPolicy.findFirst({
    where: {
      templateId: input.templateId,
      scope: "TEMPLATE",
      status: { in: ["ACTIVE", "DISABLED"] },
    },
    orderBy: { createdAt: "desc" },
    select: trustPolicyV1Select,
  });

  return templatePolicy
    ? { policy: templatePolicy, source: "TEMPLATE" }
    : { policy: null, source: null };
}

function hasCandidateEmail(candidateEmail: string | null | undefined) {
  return typeof candidateEmail === "string" && candidateEmail.trim().length > 0;
}

function evaluateActionPermission(input: {
  policy: TrustPolicyV1Policy;
  actorRole: TrustPolicyActorRole;
  action: TrustPolicyAction;
}) {
  const { policy, actorRole, action } = input;

  if (actorRole === "OWNER") {
    if (action === "READ") return policy.ownerCanRead;
    if (action === "WRITE") return policy.ownerCanWrite;
    return policy.ownerCanWrite && policy.allowDocuments;
  }

  if (action === "READ") return policy.candidateCanRead;
  if (action === "WRITE") return policy.candidateCanWrite;
  return policy.candidateCanWrite && policy.allowDocuments;
}

export function evaluateTrustPolicyV1(input: TrustPolicyEvaluationInput): TrustPolicyEvaluationResult {
  const { policy } = input;

  if (!policy) {
    return {
      allowed: true,
      reasons: ["NO_POLICY_ALLOW_BY_DEFAULT"],
      missingRequirements: [],
    };
  }

  if (policy.status === "DISABLED") {
    return {
      allowed: true,
      reasons: ["POLICY_DISABLED_ALLOW_BY_DEFAULT"],
      missingRequirements: [],
    };
  }

  const reasons: string[] = [];
  const missingRequirements: string[] = [];

  if (!evaluateActionPermission({ policy, actorRole: input.actorRole, action: input.action })) {
    reasons.push(`${input.actorRole}_${input.action}_NOT_ALLOWED`);
  }

  if (input.actorRole === "CANDIDATE") {
    if (policy.requireCandidateEmail && !hasCandidateEmail(input.candidateEmail)) {
      missingRequirements.push("CANDIDATE_EMAIL");
    }

    if (policy.requireCandidateConsent && input.candidateConsent !== true) {
      missingRequirements.push("CANDIDATE_CONSENT");
    }
  }

  const allowed = reasons.length === 0 && missingRequirements.length === 0;

  return {
    allowed,
    reasons: allowed ? [`${input.actorRole}_${input.action}_ALLOWED`] : reasons,
    missingRequirements,
  };
}

export function evaluateRelationAdmissionPolicyV1(
  input: AdmissionTrustPolicyEvaluationInput,
): TrustPolicyEvaluationResult {
  const { policy } = input;

  if (!policy) {
    return {
      allowed: true,
      reasons: ["NO_POLICY_ALLOW_BY_DEFAULT"],
      missingRequirements: [],
    };
  }

  if (policy.status === "DISABLED") {
    return {
      allowed: true,
      reasons: ["POLICY_DISABLED_ALLOW_BY_DEFAULT"],
      missingRequirements: [],
    };
  }

  const missingRequirements: string[] = [];

  if (policy.requireCandidateEmail && !hasCandidateEmail(input.candidateEmail)) {
    missingRequirements.push("CANDIDATE_EMAIL");
  }

  if (policy.requireCandidateConsent && input.candidateConsentAccepted !== true) {
    missingRequirements.push("CANDIDATE_CONSENT");
  }

  const allowed = missingRequirements.length === 0;

  return {
    allowed,
    reasons: allowed ? ["RELATION_ADMISSION_ALLOWED"] : ["RELATION_ADMISSION_REQUIREMENTS_MISSING"],
    missingRequirements,
  };
}
