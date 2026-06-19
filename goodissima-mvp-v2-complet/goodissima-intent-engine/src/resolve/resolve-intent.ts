import type { CiroBuilderV0 } from "../ciro/builder.js";
import { validateCiro } from "../ciro/validator.js";
import type { ResolutionTrace, ResolveIntentOptions, ResolveIntentResult } from "./types.js";

function createTrace(
  builder: CiroBuilderV0,
  candidates: ResolveIntentResult["candidates"],
  selectedCiroPath: ResolutionTrace["selectedCiroPath"],
  validation: ResolutionTrace["validation"],
): ResolutionTrace {
  return {
    matchedExpressions: candidates.flatMap((candidate) =>
      candidate.evidence.map((evidence) => ({
        ...evidence,
        candidateKind: candidate.kind,
        candidateLabel: candidate.label,
      })),
    ),
    candidateRanking: candidates.map((candidate, index) => ({
      rank: index + 1,
      kind: candidate.kind,
      label: candidate.label,
      confidence: candidate.confidence,
    })),
    selectedCiroPath,
    governance: { valid: true, governedPaths: builder.governedPathCount() },
    validation,
  };
}

export function resolveIntent(
  text: string,
  builder: CiroBuilderV0,
  options: ResolveIntentOptions = {},
): ResolveIntentResult {
  const detection = builder.detect(text);
  const base = {
    version: "0" as const,
    candidates: detection.candidates,
    ciro: null,
    issues: [] as string[],
  };
  const result = (
    status: ResolveIntentResult["status"],
    ciro: ResolveIntentResult["ciro"] = null,
    issues: string[] = [],
    selectedCiroPath: ResolutionTrace["selectedCiroPath"] = null,
    validation: ResolutionTrace["validation"] = { performed: false, valid: null, issues: [] },
  ): ResolveIntentResult => ({
    ...base,
    status,
    ciro,
    issues,
    ...(options.trace
      ? { trace: createTrace(builder, detection.candidates, selectedCiroPath, validation) }
      : {}),
  });

  if (detection.candidates.length === 0) {
    return result("NO_MATCH");
  }

  const intents = detection.candidates.filter((candidate) => candidate.kind === "intent");
  const modes = detection.candidates.filter((candidate) => candidate.kind === "mode");
  if (intents.length > 1 || modes.length > 1) {
    return result("MULTIPLE_MATCHES");
  }
  if (intents.length !== 1 || modes.length !== 1) {
    return result("UNMAPPED_PATH");
  }
  const selectedCiroPath = { intent: intents[0].label, mode: modes[0].label };
  if (!builder.hasPath(selectedCiroPath.intent, selectedCiroPath.mode)) {
    return result("UNMAPPED_PATH", null, [], selectedCiroPath);
  }

  try {
    const ciro = builder.build(text);
    if (!ciro) return result("UNMAPPED_PATH", null, [], selectedCiroPath);
    const validation = validateCiro(ciro);
    if (!validation.valid) {
      const issues = validation.issues.map((issue) => `${issue.path}: ${issue.message}`);
      return result("INVALID_CIRO", null, issues, selectedCiroPath, {
        performed: true,
        valid: false,
        issues,
      });
    }
    return result("RESOLVED", ciro, [], selectedCiroPath, {
      performed: true,
      valid: true,
      issues: [],
    });
  } catch (error) {
    const issues = [error instanceof Error ? error.message : String(error)];
    return result("INVALID_CIRO", null, issues, selectedCiroPath, {
      performed: true,
      valid: false,
      issues,
    });
  }
}
