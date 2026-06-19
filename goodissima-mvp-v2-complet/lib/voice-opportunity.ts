import type { ProposalChangeSet } from "./ai/opportunity-refinement.ts";

export type VoiceInteractionMode = "generation" | "refinement";

export type VoiceAuditInput = {
  mode: VoiceInteractionMode;
  transcript: string;
  capturedAt: string;
  confirmedAt?: string;
  proposalVersion: number;
  sourceGenerationId?: string;
};

export type VoiceAuditRecord = VoiceAuditInput & {
  resultingChanges: ProposalChangeSet;
};

export type OpportunityConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  proposalVersion?: number;
};

export const VOICE_STATUS_LABELS = {
  idle: "Prêt à écouter",
  listening: "Écoute en cours",
  transcribing: "Transcription",
  transcriptionReady: "Transcription prête",
  analysis: "Analyse",
  ready: "Proposition prête",
} as const;

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function parseVoiceAuditInput(value: unknown, expectedMode: VoiceInteractionMode): VoiceAuditInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.mode !== expectedMode) return null;
  const transcript = clean(source.transcript, expectedMode === "generation" ? 5000 : 2000);
  const capturedAt = clean(source.capturedAt, 40);
  if (!transcript || !capturedAt || Number.isNaN(Date.parse(capturedAt))) return null;
  const proposalVersion = Number.isInteger(source.proposalVersion) && Number(source.proposalVersion) > 0
    ? Number(source.proposalVersion)
    : 1;
  const confirmedAt = clean(source.confirmedAt, 40);
  const sourceGenerationId = clean(source.sourceGenerationId, 120);
  return {
    mode: expectedMode,
    transcript,
    capturedAt,
    proposalVersion,
    confirmedAt: confirmedAt && !Number.isNaN(Date.parse(confirmedAt)) ? confirmedAt : undefined,
    sourceGenerationId: sourceGenerationId || undefined,
  };
}

export function voiceAuditRecord(input: VoiceAuditInput, changes?: ProposalChangeSet): VoiceAuditRecord {
  return {
    ...input,
    resultingChanges: changes ?? { added: [], modified: [], removed: [] },
  };
}

export function voiceRevisionContext(input: {
  transcript: string;
  proposalVersion: number;
  stageNames: string[];
}) {
  const stages = input.stageNames.map((stage, index) => `${index + 1}. ${stage}`).join(" ; ") || "aucune étape";
  return [
    `Instruction utilisateur : ${input.transcript.trim()}`,
    `Contexte : proposition v${input.proposalVersion}, dernière version active.`,
    `Étapes actuelles : ${stages}.`,
    "Les références comme « cette annonce », « ce parcours », « cette étape » et « la dernière version » désignent cette proposition courante.",
  ].join("\n");
}

export function voiceFeatureSupported(windowValue: unknown) {
  if (!windowValue || typeof windowValue !== "object") return false;
  const candidate = windowValue as Record<string, unknown>;
  return typeof candidate.SpeechRecognition === "function" || typeof candidate.webkitSpeechRecognition === "function";
}

export function mergeVoiceTranscript(existingText: string, transcript: string) {
  return [existingText.trim(), transcript.trim()].filter(Boolean).join(" ");
}
