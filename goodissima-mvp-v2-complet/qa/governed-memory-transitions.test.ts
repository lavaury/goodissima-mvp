import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GovernedMemoryMutationService, type GovernedMemoryMutationRepository, type MemoryMutationInput } from "../lib/governed-memory/mutation-service.ts";

const requestKey = "123e4567-e89b-42d3-a456-426614174000";
const base = { requestKey, journeyId: "journey-a", relationCaseId: "case-a" };

function memoryRepository() {
  const requests = new Map<string, { fingerprint: string; result: any }>();
  let effects = 0;
  const repository: GovernedMemoryMutationRepository = {
    async execute(userId, input, fingerprint, ids) {
      const key = `${userId}:${input.operation}:${input.requestKey}`;
      const prior = requests.get(key);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new Error("MEMORY_IDEMPOTENCY_CONFLICT");
        return { ...prior.result, replayed: true };
      }
      effects++;
      const result = { objectType: input.operation.includes("DECISION") ? "DECISION" : input.operation === "REGISTER_SOURCE" ? "SOURCE" : "FACT", objectId: input.targetId ?? ids.object, replayed: false } as const;
      requests.set(key, { fingerprint, result });
      return result;
    },
  };
  return { repository, effects: () => effects };
}

test("supported creation and transition commands are explicit", async () => {
  const setup = memoryRepository(); const service = new GovernedMemoryMutationService(setup.repository);
  const inputs: MemoryMutationInput[] = [
    { ...base, operation: "PROPOSE_FACT", statement: "Observation" },
    { ...base, requestKey: "223e4567-e89b-42d3-a456-426614174000", operation: "RECORD_DECISION", title: "Décision", rationale: "Motif" },
    { ...base, requestKey: "323e4567-e89b-42d3-a456-426614174000", operation: "REGISTER_SOURCE", title: "Source", sourceObjectType: "TEST", sourceObjectId: "a" },
    { ...base, requestKey: "423e4567-e89b-42d3-a456-426614174000", operation: "ESTABLISH_FACT", targetId: "fact-a" },
    { ...base, requestKey: "523e4567-e89b-42d3-a456-426614174000", operation: "DISPUTE_FACT", targetId: "fact-a", reason: "Contesté" },
    { ...base, requestKey: "623e4567-e89b-42d3-a456-426614174000", operation: "VALIDATE_DECISION", targetId: "decision-a" },
  ];
  for (const input of inputs) assert.equal((await service.executeHuman("user-a", input)).replayed, false);
  assert.equal(setup.effects(), 6);
});

test("same request replays, different payload conflicts, concurrent calls have one effect", async () => {
  const setup = memoryRepository(); const service = new GovernedMemoryMutationService(setup.repository);
  const input: MemoryMutationInput = { ...base, operation: "PROPOSE_FACT", statement: "Stable" };
  const [first, replay] = await Promise.all([service.executeHuman("user-a", input), service.executeHuman("user-a", input)]);
  assert.equal(first.objectId, replay.objectId); assert.equal(setup.effects(), 1);
  await assert.rejects(service.executeHuman("user-a", { ...input, statement: "Different" }), /MEMORY_IDEMPOTENCY_CONFLICT/);
});

test("SYSTEM and MODEL_GAP operations are not exposed", () => {
  const service = readFileSync(new URL("../lib/governed-memory/mutation-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(service, /executeSystem|resolveDispute|maintainDispute|withdrawDispute|reviseFact|replaceDecision|cancelDecision|attachSource/);
});

test("Prisma adapter makes state, event and request completion one transaction", () => {
  const source = readFileSync(new URL("../lib/governed-memory/prisma-mutation-repository.ts", import.meta.url), "utf8");
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /governedMemoryEvent\.create/);
  assert.match(source, /governedMemoryCreationRequest\.update/);
  assert.match(source, /governedMemoryTransitionRequest\.update/);
  assert.doesNotMatch(source, /governedMemoryEvent\.(?:update|delete|upsert)/);
  assert.doesNotMatch(source, /governanceReview|governedJourneyEvent|communicationSession/);
});
