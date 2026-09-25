export const PUBLIC_CASE_MAX_BODY_BYTES = 64 * 1024;
export const PUBLIC_CASE_MAX_ANSWERS = 100;

const limits = {
  gLinkId: 160,
  candidateName: 160,
  candidateEmail: 254,
  candidateNotificationEmail: 254,
  message: 2000,
  documentName: 255,
  documentUrl: 2048,
  formTemplateId: 160,
  templateVersionId: 160,
  trustAdmissionToken: 2048,
} as const;

const allowedKeys = new Set([...Object.keys(limits), "answers", "attachments", "emailNotificationsConsent"]);
const nullableTemplateReferenceKeys = new Set(["formTemplateId", "templateVersionId"]);
const answerKeyPattern = /^[A-Za-z][A-Za-z0-9_]{0,119}$/;

export type PublicCaseContractFailure = {
  ok: false;
  status: 400 | 413 | 415;
  code: "INVALID_REQUEST_BODY" | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE";
  error: string;
  reasons: string[];
};

export type PublicCaseContractResult =
  | { ok: true; body: Record<string, unknown> }
  | PublicCaseContractFailure;

function failure(status: PublicCaseContractFailure["status"], code: PublicCaseContractFailure["code"], reason: string): PublicCaseContractFailure {
  return { ok: false, status, code, error: code === "PAYLOAD_TOO_LARGE" ? "Payload too large" : "Invalid request body", reasons: [reason] };
}

function validateBody(body: unknown): PublicCaseContractResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return failure(400, "INVALID_REQUEST_BODY", "body_must_be_object");
  const row = body as Record<string, unknown>;
  if (Object.keys(row).some((key) => !allowedKeys.has(key))) return failure(400, "INVALID_REQUEST_BODY", "unexpected_field");

  for (const [key, max] of Object.entries(limits)) {
    const value = row[key];
    if (value === null && nullableTemplateReferenceKeys.has(key)) continue;
    if (value !== undefined && typeof value !== "string") return failure(400, "INVALID_REQUEST_BODY", `${key}_must_be_string`);
    if (typeof value === "string" && value.length > max) return failure(400, "INVALID_REQUEST_BODY", `${key}_too_long`);
  }
  if (row.emailNotificationsConsent !== undefined && typeof row.emailNotificationsConsent !== "boolean") {
    return failure(400, "INVALID_REQUEST_BODY", "emailNotificationsConsent_must_be_boolean");
  }
  if (row.answers !== undefined) {
    if (!row.answers || typeof row.answers !== "object" || Array.isArray(row.answers)) return failure(400, "INVALID_REQUEST_BODY", "answers_must_be_object");
    const entries = Object.entries(row.answers as Record<string, unknown>);
    if (entries.length > PUBLIC_CASE_MAX_ANSWERS) return failure(400, "INVALID_REQUEST_BODY", "answers_too_many");
    for (const [key, value] of entries) {
      if (!answerKeyPattern.test(key)) return failure(400, "INVALID_REQUEST_BODY", "answer_key_invalid");
      if (Array.isArray(value)) {
        if (value.length > 20 || value.some((item) => typeof item !== "string" || item.length > 500)) {
          return failure(400, "INVALID_REQUEST_BODY", "answer_value_invalid");
        }
        continue;
      }
      if (!["string", "number", "boolean"].includes(typeof value) && value !== null) return failure(400, "INVALID_REQUEST_BODY", "answer_value_invalid");
      if (typeof value === "string" && value.length > 2000) return failure(400, "INVALID_REQUEST_BODY", "answer_value_too_long");
      if (typeof value === "number" && !Number.isFinite(value)) return failure(400, "INVALID_REQUEST_BODY", "answer_value_invalid");
    }
  }
  if (row.attachments !== undefined && (!Array.isArray(row.attachments) || row.attachments.length > 10 || row.attachments.some((item) => typeof item !== "string" || item.length > 4096))) {
    return failure(400, "INVALID_REQUEST_BODY", "attachments_invalid");
  }
  if ((row.documentName && !row.documentUrl) || (row.documentUrl && !row.documentName)) {
    return failure(400, "INVALID_REQUEST_BODY", "document_reference_incomplete");
  }
  const normalizedBody = { ...row };
  if (normalizedBody.formTemplateId === null) delete normalizedBody.formTemplateId;
  if (normalizedBody.templateVersionId === null) delete normalizedBody.templateVersionId;
  return { ok: true, body: normalizedBody };
}

export async function readPublicCaseRequest(req: Request): Promise<PublicCaseContractResult> {
  const contentType = req.headers?.get ? req.headers.get("content-type") : "application/json";
  if (!contentType?.toLowerCase().includes("application/json")) return failure(415, "UNSUPPORTED_MEDIA_TYPE", "content_type_must_be_json");
  try {
    if (typeof req.text === "function") {
      const text = await req.text();
      if (new TextEncoder().encode(text).byteLength > PUBLIC_CASE_MAX_BODY_BYTES) return failure(413, "PAYLOAD_TOO_LARGE", "body_too_large");
      return validateBody(JSON.parse(text));
    }
    return validateBody(await req.json());
  } catch {
    return failure(400, "INVALID_REQUEST_BODY", "invalid_json");
  }
}

export function validateExpectedAnswerCount(body: Record<string, unknown>, expectedFieldCount: number) {
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return true;
  const businessKeys = Object.keys(body.answers).filter((key) => key !== "simpleRuleSignals");
  return businessKeys.length <= Math.min(Math.max(expectedFieldCount, 0), PUBLIC_CASE_MAX_ANSWERS);
}
