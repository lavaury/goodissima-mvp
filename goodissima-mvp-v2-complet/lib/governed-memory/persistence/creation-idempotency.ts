import { createHash, timingSafeEqual } from "node:crypto";
import type { GovernedMemoryCreationCategory, GovernedMemoryEvidenceLevel, GovernedMemorySourceKind } from "@prisma/client";

const requestKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function normalizeMemoryCreationRequestKey(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return requestKeyPattern.test(normalized) ? normalized : null;
}

export type MemoryCreationCanonicalPayload = {
  category: GovernedMemoryCreationCategory;
  requesterUserId: string;
  formTemplateId: string;
  relationTemplateId: string;
  governedJourneyId: string;
  relationCaseId: string | null;
  business:
    | { statement: string; evidenceLevel: GovernedMemoryEvidenceLevel; effectiveFrom: string; effectiveUntil: string | null; provenance: string | null }
    | { title: string; rationale: string; decidedAt: string; effectiveFrom: string; effectiveUntil: string | null; consequences: string | null; reservations: string | null; provenance: string | null }
    | { kind: GovernedMemorySourceKind; title: string; sourceObjectId: string; authoredAt: string | null; receivedAt: string | null; visibilityPolicyRef: string | null; externalOrigin: string | null; provenance: string | null };
};

export function buildMemoryCreationFingerprint(input: MemoryCreationCanonicalPayload) {
  const canonical = { contractVersion: 1, category: input.category, requesterUserId: input.requesterUserId,
    formTemplateId: input.formTemplateId, relationTemplateId: input.relationTemplateId,
    governedJourneyId: input.governedJourneyId, relationCaseId: input.relationCaseId, business: input.business };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function memoryFingerprintsEqual(left: string, right: string) {
  if (left.length !== 64 || right.length !== 64) return false;
  const a = Buffer.from(left, "utf8"); const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildPublicMemoryKey(category: GovernedMemoryCreationCategory, id: string) {
  return createHash("sha256").update(`governed-memory:public:v1:${category}:${id}`, "utf8").digest("hex");
}
