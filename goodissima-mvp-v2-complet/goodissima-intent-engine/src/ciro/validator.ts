import {
  CIRO_SCHEMA_VERSION,
  type CiroRecord,
  type JsonValue,
} from "./model.js";

export interface CiroValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type CiroValidationResult =
  | { valid: true; value: CiroRecord; issues: [] }
  | { valid: false; issues: CiroValidationIssue[] };

export interface CiroValidationOptions {
  knownKnowledgeIds?: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

export function validateCiro(
  candidate: unknown,
  options: CiroValidationOptions = {},
): CiroValidationResult {
  const issues: CiroValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return {
      valid: false,
      issues: [
        {
          path: "$",
          code: "invalid_type",
          message: "CIRO must be a JSON object.",
        },
      ],
    };
  }

  if (candidate.schemaVersion !== CIRO_SCHEMA_VERSION) {
    issues.push({
      path: "$.schemaVersion",
      code: "unsupported_schema_version",
      message: `schemaVersion must be ${CIRO_SCHEMA_VERSION}.`,
    });
  }

  for (const key of ["c", "i", "r", "o"] as const) {
    if (!(key in candidate)) {
      issues.push({
        path: `$.${key}`,
        code: "required",
        message: `${key} is required.`,
      });
    } else if (!isJsonValue(candidate[key])) {
      issues.push({
        path: `$.${key}`,
        code: "invalid_json_value",
        message: `${key} must contain a JSON value.`,
      });
    }
  }

  if (!Array.isArray(candidate.sources) || candidate.sources.length === 0) {
    issues.push({
      path: "$.sources",
      code: "source_required",
      message: "At least one knowledge source is required.",
    });
  } else {
    candidate.sources.forEach((source, index) => {
      const path = `$.sources[${index}]`;
      if (!isRecord(source) || typeof source.knowledgeId !== "string" || !source.knowledgeId.trim()) {
        issues.push({
          path,
          code: "invalid_source",
          message: "Each source must have a non-empty knowledgeId.",
        });
        return;
      }

      if (source.locator !== undefined && typeof source.locator !== "string") {
        issues.push({
          path: `${path}.locator`,
          code: "invalid_locator",
          message: "locator must be a string when provided.",
        });
      }

      if (
        options.knownKnowledgeIds &&
        !options.knownKnowledgeIds.has(source.knowledgeId)
      ) {
        issues.push({
          path: `${path}.knowledgeId`,
          code: "unknown_knowledge_source",
          message: `Unknown knowledge source: ${source.knowledgeId}.`,
        });
      }
    });
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return { valid: true, value: candidate as unknown as CiroRecord, issues: [] };
}
