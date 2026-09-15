"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { executeJourneyMemoryMutation } from "./mutation-runtime";
import type { MemoryMutationInput, SupportedMemoryMutation } from "./mutation-service";

type JourneyActionContext = { journeyId: string; relationCaseId: string | null; formTemplateId: string };

function value(formData: FormData, name: string) {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
}

async function mutate(context: JourneyActionContext, operation: SupportedMemoryMutation, data: Omit<MemoryMutationInput, "operation" | "requestKey" | "journeyId" | "relationCaseId">) {
  await executeJourneyMemoryMutation({ operation, requestKey: randomUUID(), journeyId: context.journeyId, ...(context.relationCaseId ? { relationCaseId: context.relationCaseId } : {}), ...data });
  revalidatePath(`/gouvernance/parcours/${context.formTemplateId}/pilotage`);
}

export async function proposeJourneyFactAction(context: JourneyActionContext, formData: FormData) {
  await mutate(context, "PROPOSE_FACT", { statement: value(formData, "statement") });
}

export async function recordJourneyDecisionAction(context: JourneyActionContext, formData: FormData) {
  await mutate(context, "RECORD_DECISION", { title: value(formData, "title"), rationale: value(formData, "rationale") });
}

export async function registerJourneySourceAction(context: JourneyActionContext, formData: FormData) {
  const reference = value(formData, "reference");
  await mutate(context, "REGISTER_SOURCE", { title: value(formData, "title"), sourceKind: "HUMAN_DECLARATION", sourceObjectType: "Référence fournie par l’utilisateur", sourceObjectId: reference });
}

export async function establishJourneyFactAction(context: JourneyActionContext, targetId: string) {
  await mutate(context, "ESTABLISH_FACT", { targetId });
}

export async function validateJourneyDecisionAction(context: JourneyActionContext, targetId: string) {
  await mutate(context, "VALIDATE_DECISION", { targetId });
}

export async function disputeJourneyFactAction(context: JourneyActionContext, targetId: string, formData: FormData) {
  await mutate(context, "DISPUTE_FACT", { targetId, reason: value(formData, "reason") });
}
