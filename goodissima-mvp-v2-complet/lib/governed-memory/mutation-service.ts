import { createHash, randomUUID } from "node:crypto";

export type SupportedMemoryMutation = "PROPOSE_FACT" | "RECORD_DECISION" | "REGISTER_SOURCE" | "ESTABLISH_FACT" | "DISPUTE_FACT" | "VALIDATE_DECISION";
export type MemoryMutationInput = {
  operation: SupportedMemoryMutation;
  requestKey: string;
  journeyId: string;
  relationCaseId?: string;
  statement?: string;
  title?: string;
  rationale?: string;
  reason?: string;
  targetId?: string;
  sourceKind?: "DOCUMENT" | "DOCUMENT_VERSION" | "FORM_SUBMISSION" | "MESSAGE_EXCERPT" | "SYSTEM_EVENT" | "HUMAN_DECLARATION" | "VALIDATED_SYNTHESIS" | "EXTERNAL_IMPORT";
  sourceObjectType?: string;
  sourceObjectId?: string;
};
export type MemoryMutationResult = { objectType: "FACT" | "DECISION" | "SOURCE"; objectId: string; replayed: boolean };

export interface GovernedMemoryMutationRepository {
  execute(userId: string, input: MemoryMutationInput, fingerprint: string, ids: { request: string; object: string; event: string; auxiliary: string }, now: Date): Promise<MemoryMutationResult>;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export class GovernedMemoryMutationService {
  private readonly repository: GovernedMemoryMutationRepository;
  private readonly now: () => Date;
  constructor(repository: GovernedMemoryMutationRepository, now: () => Date = () => new Date()) { this.repository = repository; this.now = now; }

  async executeHuman(userId: string, input: MemoryMutationInput): Promise<MemoryMutationResult> {
    if (!userId.trim() || !input.journeyId.trim() || (input.relationCaseId !== undefined && !input.relationCaseId.trim())) throw new Error("MEMORY_NOT_FOUND");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestKey)) throw new Error("MEMORY_INVALID_REQUEST_KEY");
    const fingerprint = createHash("sha256").update(canonical(input)).digest("hex");
    return this.repository.execute(userId, input, fingerprint, { request: randomUUID(), object: randomUUID(), event: randomUUID(), auxiliary: randomUUID() }, this.now());
  }

  // No SYSTEM entry point exists: final qualification can only enter through an authenticated human operation.
}
