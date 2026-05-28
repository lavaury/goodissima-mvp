import type { RelationActionType } from "@/lib/relation-actions";
import type {
  AISuggestedAction,
  AISuggestedActionType,
  AITimelineActionType,
  AITimelineNextBestAction,
} from "@/lib/ai/types";

export const aiSuggestedActionTypes = [
  "REQUEST_DOCUMENT",
  "FOLLOW_UP",
  "REQUEST_CLARIFICATION",
  "SCHEDULE_EXCHANGE",
  "INVESTOR_FOLLOW_UP",
] as const satisfies readonly AISuggestedActionType[];

const aiToRelationActionType: Record<AISuggestedActionType, RelationActionType> = {
  REQUEST_DOCUMENT: "DOCUMENT_REQUEST",
  FOLLOW_UP: "TASK",
  REQUEST_CLARIFICATION: "TASK",
  SCHEDULE_EXCHANGE: "TASK",
  INVESTOR_FOLLOW_UP: "TASK",
};

export const aiTimelineActionTypes = [...aiSuggestedActionTypes, "VALIDATION_REVIEW"] as const satisfies readonly AITimelineActionType[];

const aiTimelineToRelationActionType: Record<AITimelineActionType, RelationActionType> = {
  ...aiToRelationActionType,
  VALIDATION_REVIEW: "VALIDATION",
};

export function isAISuggestedActionType(value: unknown): value is AISuggestedActionType {
  return typeof value === "string" && aiSuggestedActionTypes.includes(value as AISuggestedActionType);
}

export function mapAIActionToRelationActionType(type: AISuggestedActionType): RelationActionType {
  return aiToRelationActionType[type];
}

export function isAITimelineActionType(value: unknown): value is AITimelineActionType {
  return typeof value === "string" && aiTimelineActionTypes.includes(value as AITimelineActionType);
}

export function mapAITimelineActionToRelationActionType(type: AITimelineActionType): RelationActionType {
  return aiTimelineToRelationActionType[type];
}

export function cleanText(value: string, maxLength: number) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLength);
}

export function cleanAISuggestedAction(value: unknown): AISuggestedAction | null {
  if (!value || typeof value !== "object") return null;

  const action = value as Record<string, unknown>;
  const label = typeof action.label === "string" ? cleanText(action.label, 180) : "";
  const reason = typeof action.reason === "string" ? cleanText(action.reason, 600) : "";

  if (!label || !reason || !isAISuggestedActionType(action.type)) return null;

  return {
    label,
    type: action.type,
    reason,
  };
}

export function cleanAITimelineAction(value: unknown): AITimelineNextBestAction | null {
  if (!value || typeof value !== "object") return null;

  const action = value as Record<string, unknown>;
  const label = typeof action.label === "string" ? cleanText(action.label, 180) : "";
  const reason = typeof action.reason === "string" ? cleanText(action.reason, 600) : "";

  if (!label || !reason || !isAITimelineActionType(action.type)) return null;

  return {
    label,
    type: action.type,
    reason,
  };
}
