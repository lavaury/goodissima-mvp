CREATE TYPE "LinkAdmissionMode" AS ENUM ('OPEN', 'VERIFIED_ONLY');

ALTER TABLE "GLink"
ADD COLUMN "admissionMode" "LinkAdmissionMode" NOT NULL DEFAULT 'OPEN';

UPDATE "GLink" AS link
SET "admissionMode" = 'VERIFIED_ONLY'
WHERE EXISTS (
  SELECT 1
  FROM "TrustPolicy" AS policy
  INNER JOIN "TrustPolicyCredentialRequirement" AS requirement
    ON requirement."trustPolicyId" = policy.id
  INNER JOIN "CredentialType" AS credential_type
    ON credential_type.id = requirement."credentialTypeId"
  WHERE policy."gLinkId" = link.id
    AND policy.scope = 'GLINK'
    AND policy.status = 'ACTIVE'
    AND credential_type.code = 'VERIFIED_IDENTITY'
);

UPDATE "TrustPolicy" AS policy
SET "requireCandidateEmail" = FALSE
WHERE policy.scope = 'GLINK'
  AND policy.status = 'ACTIVE'
  AND EXISTS (
    SELECT 1
    FROM "TrustPolicyCredentialRequirement" AS requirement
    INNER JOIN "CredentialType" AS credential_type
      ON credential_type.id = requirement."credentialTypeId"
    WHERE requirement."trustPolicyId" = policy.id
      AND credential_type.code = 'VERIFIED_IDENTITY'
  );
