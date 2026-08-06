"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  createJourneyDecisionDraft,
  GovernedMemoryCreationError,
  proposeJourneyFact,
  registerJourneySource,
} from "./persistence/journey-creation-service";
import {
  formDate,
  formText,
  GovernedMemoryActionInputError,
  optionalFormText,
  type GovernedMemoryCreationActionState,
} from "./cockpit-creation-action-service";

const messages = {
  INVALID_INPUT: "Vérifiez les champs indiqués puis réessayez.",
  NOT_FOUND: "Ce parcours n’est plus disponible.",
  FORBIDDEN: "Vous n’êtes pas autorisé à enregistrer cet élément.",
  CREATION_CONFLICT: "Cette tentative entre en conflit avec un enregistrement existant. Rechargez la page avant de réessayer.",
  GOVERNED_MEMORY_CREATION_FAILED: "L’enregistrement n’a pas pu être finalisé. Aucune mémoire n’a été ajoutée.",
} as const;

function mapError(error: unknown): GovernedMemoryCreationActionState {
  const code = error instanceof GovernedMemoryActionInputError
    ? "INVALID_INPUT"
    : error instanceof GovernedMemoryCreationError
      ? error.code
      : "GOVERNED_MEMORY_CREATION_FAILED";
  return { status: "ERROR", code, message: messages[code], ...(code === "INVALID_INPUT" ? { fieldErrors: { form: "Un ou plusieurs champs sont invalides." } } : {}) };
}

async function execute(
  formData: FormData,
  category: "FACT" | "DECISION" | "SOURCE",
  successMessage: string,
  command: (common: { requesterUserId: string; formTemplateId: string; requestKey: string }) => Promise<unknown>,
): Promise<GovernedMemoryCreationActionState> {
  try {
    const owner = await getCurrentPrismaUser();
    const formTemplateId = formText(formData, "formTemplateId");
    const requestKey = formText(formData, "requestKey");
    await command({ requesterUserId: owner.id, formTemplateId, requestKey });
    revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
    return { status: "SUCCESS", category, message: successMessage };
  } catch (error) {
    return mapError(error);
  }
}

export async function retainJourneyFactAction(_previous: GovernedMemoryCreationActionState, formData: FormData) {
  return execute(formData, "FACT", "Le fait a été retenu dans la mémoire du parcours.", (common) => proposeJourneyFact({
    ...common,
    statement: formText(formData, "statement"),
    evidenceLevel: formText(formData, "evidenceLevel") as "DECLARED" | "SUPPORTED" | "CORROBORATED" | "CONTESTED",
    effectiveFrom: formDate(formData, "effectiveFrom")!,
    effectiveUntil: formDate(formData, "effectiveUntil", false),
    provenance: optionalFormText(formData, "provenance"),
  }));
}

export async function retainJourneyDecisionAction(_previous: GovernedMemoryCreationActionState, formData: FormData) {
  return execute(formData, "DECISION", "La décision a été consignée comme brouillon.", (common) => createJourneyDecisionDraft({
    ...common,
    title: formText(formData, "title"),
    rationale: formText(formData, "rationale"),
    decidedAt: formDate(formData, "decidedAt")!,
    effectiveFrom: formDate(formData, "effectiveFrom")!,
    effectiveUntil: formDate(formData, "effectiveUntil", false),
    consequences: optionalFormText(formData, "consequences"),
    reservations: optionalFormText(formData, "reservations"),
    provenance: optionalFormText(formData, "provenance"),
  }));
}

export async function retainJourneySourceAction(_previous: GovernedMemoryCreationActionState, formData: FormData) {
  return execute(formData, "SOURCE", "La source a été référencée dans la mémoire du parcours.", (common) => {
    const kind = formText(formData, "kind") as "DOCUMENT" | "DOCUMENT_VERSION" | "FORM_SUBMISSION" | "SYSTEM_EVENT" | "HUMAN_DECLARATION" | "EXTERNAL_IMPORT";
    const reference = formText(formData, "sourceObjectId");
    return registerJourneySource({
      ...common,
      kind,
      title: formText(formData, "title"),
      sourceObjectId: reference,
      authoredAt: formDate(formData, "authoredAt", false),
      receivedAt: formDate(formData, "receivedAt", false),
      visibilityPolicyRef: optionalFormText(formData, "visibilityPolicyRef"),
      externalOrigin: kind === "EXTERNAL_IMPORT" ? reference : null,
      provenance: optionalFormText(formData, "provenance"),
    });
  });
}
