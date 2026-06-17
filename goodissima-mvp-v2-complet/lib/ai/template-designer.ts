import type { Prisma } from "@prisma/client";
import { getConfiguredAIProvider } from "@/lib/ai/service";
import { prisma } from "@/lib/prisma";
import { getAIUsageFromError, recordAIEvent, toAIEventUsageData } from "@/lib/ai/observability";
import { describeProposalChanges, type ProposalChangeSet } from "@/lib/ai/opportunity-refinement";
import { voiceAuditRecord, type VoiceAuditInput } from "@/lib/voice-opportunity";

export const templateDesignerPromptVersion = "template-designer-fr-v1";
export const templateRefinementPromptVersion = "template-designer-refinement-fr-v1";

const allowedFieldTypes = new Set(["TEXT", "EMAIL", "TEXTAREA", "SELECT", "CHECKBOX", "FILE", "DATE", "NUMBER"]);

export type TemplateDesignerDraft = {
  name: string;
  description: string;
  actors: Array<{ name: string; role: string }>;
  stages: Array<{
    name: string;
    objective: string;
    expectedAction?: string;
    responsibleActor?: string;
    deadline?: string;
    exitCondition?: string;
  }>;
  documents: Array<{ name: string; required: boolean; stage: number }>;
  relationalRequests: Array<{
    title: string;
    description: string;
    stage: number;
    targetActor?: string;
    deadline?: string;
  }>;
  kpis: Array<{ name: string; description: string; unit: string }>;
  fields: Array<{
    key: string;
    label: string;
    type: string;
    required: boolean;
    step: number;
    placeholder?: string;
  }>;
};

type GenerationResult = {
  draft: TemplateDesignerDraft;
  provenance: {
    provider: string;
    model: string;
    promptVersion: string;
    language: "fr";
    generatedAt: string;
  };
  usage: {
    tokensInput?: number | null;
    tokensOutput?: number | null;
    estimatedCostEur?: number | null;
    latencyMs?: number | null;
  };
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function integer(value: unknown, fallback = 1) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function keyFromLabel(value: string, index: number) {
  const key = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")
    .replace(/^./, (character) => character.toLowerCase());
  return key || `champ${index + 1}`;
}

export function parseTemplateDesignerDraft(value: unknown): TemplateDesignerDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_TEMPLATE_DRAFT");
  }

  const source = value as Record<string, unknown>;
  const stages = list(source.stages).map((item) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: text(row.name),
      objective: text(row.objective),
      expectedAction: text(row.expectedAction) || undefined,
      responsibleActor: text(row.responsibleActor) || undefined,
      deadline: text(row.deadline) || undefined,
      exitCondition: text(row.exitCondition) || undefined,
    };
  });

  const fields = list(source.fields).map((item, index) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const label = text(row.label, `Champ ${index + 1}`);
    const type = text(row.type, "TEXT").toUpperCase();
    return {
      key: text(row.key, keyFromLabel(label, index)).slice(0, 80),
      label,
      type,
      required: row.required === true,
      step: Math.min(integer(row.step), Math.max(stages.length, 1)),
      placeholder: text(row.placeholder) || undefined,
    };
  });

  return {
    name: text(source.name),
    description: text(source.description),
    actors: list(source.actors).map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return { name: text(row.name), role: text(row.role) };
    }),
    stages,
    documents: list(source.documents).map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return { name: text(row.name), required: row.required === true, stage: Math.min(integer(row.stage), Math.max(stages.length, 1)) };
    }),
    relationalRequests: list(source.relationalRequests).map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return {
        title: text(row.title),
        description: text(row.description),
        stage: Math.min(integer(row.stage), Math.max(stages.length, 1)),
        targetActor: text(row.targetActor) || undefined,
        deadline: text(row.deadline) || undefined,
      };
    }),
    kpis: list(source.kpis).map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      return { name: text(row.name), description: text(row.description), unit: text(row.unit) };
    }),
    fields,
  };
}

function mockDraft(description: string): TemplateDesignerDraft {
  return {
    name: "Parcours relationnel assisté",
    description: `Parcours proposé à partir du besoin suivant : ${description.slice(0, 220)}`,
    actors: [
      { name: "Responsable du parcours", role: "Pilote la relation et valide les décisions" },
      { name: "Participant", role: "Fournit les informations et documents demandés" },
    ],
    stages: [
      { name: "Cadrage", objective: "Qualifier le besoin et identifier les parties prenantes", expectedAction: "Confirmer le périmètre", responsibleActor: "Responsable du parcours", deadline: "Sous 2 jours", exitCondition: "Le besoin et les acteurs sont confirmés" },
      { name: "Collecte", objective: "Recueillir les informations et justificatifs utiles", expectedAction: "Transmettre les éléments demandés", responsibleActor: "Participant", deadline: "Sous 7 jours", exitCondition: "Les éléments requis sont reçus ou signalés comme indisponibles" },
      { name: "Validation humaine", objective: "Relire le dossier et décider des suites à donner", expectedAction: "Valider ou demander des précisions", responsibleActor: "Responsable du parcours", deadline: "Sous 3 jours" },
    ],
    documents: [{ name: "Pièce justificative", required: false, stage: 2 }],
    relationalRequests: [
      { title: "Préciser le besoin", description: "Demander les informations manquantes sans déclencher d'action automatique", stage: 1, targetActor: "Participant", deadline: "Sous 2 jours" },
      { title: "Valider le dossier", description: "Soumettre le dossier à une validation humaine", stage: 3, targetActor: "Responsable du parcours", deadline: "Sous 3 jours" },
    ],
    kpis: [
      { name: "Taux de complétude", description: "Part des informations demandées effectivement reçues", unit: "%" },
      { name: "Délai de traitement", description: "Temps écoulé entre le cadrage et la validation", unit: "jours" },
    ],
    fields: [
      { key: "nomComplet", label: "Nom complet", type: "TEXT", required: true, step: 1 },
      { key: "email", label: "Adresse e-mail", type: "EMAIL", required: true, step: 1 },
      { key: "besoin", label: "Description du besoin", type: "TEXTAREA", required: true, step: 1 },
      { key: "justificatif", label: "Pièce justificative", type: "FILE", required: false, step: 2 },
      { key: "confirmation", label: "Je confirme l'exactitude des informations transmises", type: "CHECKBOX", required: true, step: 3 },
    ],
  };
}

function includesAny(value: string, words: string[]) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return words.some((word) => normalized.includes(word));
}

export function applyMockTemplateRevision(current: TemplateDesignerDraft, feedback: string): TemplateDesignerDraft {
  const next = structuredClone(current);
  if (includesAny(feedback, ["supprime le garant", "retire le garant", "sans garant"])) {
    next.actors = next.actors.filter((item) => !includesAny(`${item.name} ${item.role}`, ["garant"]));
    next.relationalRequests = next.relationalRequests.filter((item) => !includesAny(`${item.title} ${item.description} ${item.targetActor ?? ""}`, ["garant"]));
    next.fields = next.fields.filter((item) => !includesAny(`${item.key} ${item.label}`, ["garant"]));
  } else if (includesAny(feedback, ["verification des revenus", "vérification des revenus"])) {
    const stage = { name: "Vérification des revenus", objective: "Vérifier les justificatifs de revenus transmis", expectedAction: "Contrôler la cohérence des revenus", responsibleActor: "Responsable du parcours", deadline: "Sous 2 jours", exitCondition: "Les revenus ont été vérifiés humainement" };
    if (!next.stages.some((item) => item.name === stage.name)) next.stages.push(stage);
  } else if (includesAny(feedback, ["plus rassurante", "plus rassurant", "rassurante"])) {
    next.description = `${next.description} Chaque étape reste transparente, expliquée et soumise à votre validation.`;
  } else if (includesAny(feedback, ["proximite des transports", "proximité des transports"])) {
    if (!next.fields.some((item) => item.key === "proximiteTransports")) next.fields.push({ key: "proximiteTransports", label: "Proximité des transports", type: "TEXT", required: false, step: 1, placeholder: "Métro, bus ou gare à proximité" });
  } else if (includesAny(feedback, ["deja certifies", "déjà certifiés", "uniquement des candidats certifies", "uniquement des candidats certifiés"])) {
    next.description = `${next.description} Cette proposition cible uniquement des candidats dont la certification a déjà été vérifiée.`;
    if (!next.fields.some((item) => item.key === "certificationVerifiee")) next.fields.push({ key: "certificationVerifiee", label: "Certification déjà vérifiée", type: "CHECKBOX", required: true, step: 1 });
  } else if (includesAny(feedback, ["visite virtuelle"])) {
    if (!next.stages.some((item) => includesAny(item.name, ["visite virtuelle"]))) next.stages.push({ name: "Visite virtuelle", objective: "Permettre une première découverte à distance", expectedAction: "Consulter la visite virtuelle", responsibleActor: "Participant", deadline: "Avant la visite sur place", exitCondition: "La visite virtuelle a été consultée" });
  } else if (includesAny(feedback, ["document obligatoire"])) {
    if (!next.documents.some((item) => item.required)) next.documents.push({ name: "Document obligatoire à préciser", required: true, stage: 1 });
  } else if (includesAny(feedback, ["deuxieme etape", "deuxième étape"]) && next.stages[1]) {
    next.stages[1] = { ...next.stages[1], objective: `${next.stages[1].objective} Modification demandée : ${feedback.trim()}` };
  } else {
    next.description = `${next.description} Précision demandée : ${feedback.trim()}`;
  }
  return parseTemplateDesignerDraft(next);
}

function extractJson(output: string) {
  const trimmed = output.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as unknown;
}

export async function generateTemplateDraft(
  description: string,
  observability?: { userId: string; organizationId?: string; organizationName?: string },
): Promise<GenerationResult> {
  const provider = getConfiguredAIProvider();
  if (provider.name === "mock") {
    return {
      draft: mockDraft(description),
      provenance: { provider: provider.name, model: provider.model, promptVersion: templateDesignerPromptVersion, language: "fr", generatedAt: new Date().toISOString() },
      usage: {},
    };
  }

  let result;
  try {
    result = await provider.chat({
      system: [
        "Tu es le concepteur de modèles Goodissima.",
        "Réponds exclusivement en français avec un objet JSON strict.",
        "Schéma: {name,description,actors:[{name,role}],stages:[{name,objective,expectedAction,responsibleActor,deadline,exitCondition}],documents:[{name,required,stage}],relationalRequests:[{title,description,stage,targetActor,deadline}],kpis:[{name,description,unit}],fields:[{key,label,type,required,step,placeholder}]}",
        "Types de champs autorisés: TEXT, EMAIL, TEXTAREA, SELECT, CHECKBOX, FILE, DATE, NUMBER.",
        "La sortie est un brouillon. N'exécute aucun workflow, ne publie rien et n'invente aucune automatisation cachée.",
        "Prévois toujours une étape de validation humaine avant toute décision.",
        "Pour chaque étape, indique une action attendue, un acteur responsable, un délai explicite et une condition de sortie vérifiable.",
        "Pour chaque demande relationnelle, indique l'acteur cible et un délai explicite.",
      ].join("\n"),
      prompt: description,
      metadata: { promptVersion: templateDesignerPromptVersion, language: "fr" },
    });
  } catch (error) {
    if (observability) {
      await recordAIEvent({
        ...observability,
        featureName: "template_designer",
        provider: provider.name,
        model: provider.model,
        action: "template_generation",
        status: "error",
        promptVersion: templateDesignerPromptVersion,
        errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_TEMPLATE_GENERATION_ERROR",
        usage: getAIUsageFromError(error),
      });
    }
    throw error;
  }

  return {
    draft: parseTemplateDesignerDraft(extractJson(result.output)),
    provenance: { provider: result.provider, model: result.model, promptVersion: templateDesignerPromptVersion, language: "fr", generatedAt: new Date().toISOString() },
    usage: result,
  };
}

export async function reviseTemplateDraft(
  current: TemplateDesignerDraft,
  feedback: string,
  observability?: { userId: string; organizationId?: string; organizationName?: string },
): Promise<GenerationResult & { changes: ProposalChangeSet }> {
  const provider = getConfiguredAIProvider();
  if (provider.name === "mock") {
    const draft = applyMockTemplateRevision(current, feedback);
    return {
      draft,
      changes: describeProposalChanges(current as unknown as Record<string, unknown>, draft as unknown as Record<string, unknown>),
      provenance: { provider: provider.name, model: provider.model, promptVersion: templateRefinementPromptVersion, language: "fr", generatedAt: new Date().toISOString() },
      usage: {},
    };
  }

  let result;
  try {
    result = await provider.chat({
      system: [
        "Tu révises une proposition Goodissima existante à partir du commentaire de l'utilisateur.",
        "Ne repars jamais de zéro. Conserve strictement tous les éléments qui ne sont pas concernés par le commentaire.",
        "Résous les références contextuelles comme cette annonce, ce parcours, cette étape, la deuxième étape et la dernière version à partir de la proposition actuelle fournie.",
        "Réponds exclusivement en français avec l'objet JSON complet, sans markdown.",
        "N'exécute aucun workflow, ne publie rien, ne contacte personne et conserve une validation humaine avant toute décision.",
      ].join("\n"),
      prompt: `PROPOSITION ACTUELLE:\n${JSON.stringify(current)}\n\nCOMMENTAIRE DE RÉVISION:\n${feedback}`,
      metadata: { promptVersion: templateRefinementPromptVersion, language: "fr" },
    });
  } catch (error) {
    if (observability) await recordAIEvent({ ...observability, featureName: "template_designer", provider: provider.name, model: provider.model, action: "template_revision", status: "error", promptVersion: templateRefinementPromptVersion, errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_TEMPLATE_REVISION_ERROR", usage: getAIUsageFromError(error) });
    throw error;
  }
  const draft = parseTemplateDesignerDraft(extractJson(result.output));
  return {
    draft,
    changes: describeProposalChanges(current as unknown as Record<string, unknown>, draft as unknown as Record<string, unknown>),
    provenance: { provider: result.provider, model: result.model, promptVersion: templateRefinementPromptVersion, language: "fr", generatedAt: new Date().toISOString() },
    usage: result,
  };
}

export async function recordTemplateGeneration(params: { createdById: string; description: string; result: GenerationResult; parentGenerationId?: string; proposalVersion?: number; revisionFeedback?: string; changes?: ProposalChangeSet; voiceAudit?: VoiceAuditInput | null }) {
  return prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: params.createdById },
      select: { name: true, email: true },
    });
    const aiEvent = await tx.aIEvent.create({
      data: {
        userId: params.createdById,
        organizationId: params.createdById,
        organizationName: owner?.name ?? owner?.email ?? null,
        featureName: "template_designer",
        provider: params.result.provenance.provider,
        model: params.result.provenance.model,
        action: params.parentGenerationId ? "template_revision" : "template_generation",
        status: "success",
        promptVersion: params.result.provenance.promptVersion,
        outputSummary: params.result.draft.name.slice(0, 500),
        ...toAIEventUsageData(params.result.usage),
      },
    });
    const changes = params.voiceAudit
      ? { ...(params.changes ?? { added: [], modified: [], removed: [] }), voiceAudit: voiceAuditRecord(params.voiceAudit, params.changes) }
      : params.changes;
    const generation = await tx.templateGeneration.create({
      data: {
        createdById: params.createdById,
        inputDescription: params.description,
        language: "fr",
        output: params.result.draft as unknown as Prisma.InputJsonValue,
        provider: params.result.provenance.provider,
        model: params.result.provenance.model,
        promptVersion: params.result.provenance.promptVersion,
        aiEventId: aiEvent.id,
        parentGenerationId: params.parentGenerationId,
        proposalVersion: params.proposalVersion ?? 1,
        revisionFeedback: params.revisionFeedback,
        changes: changes as unknown as Prisma.InputJsonValue | undefined,
      },
    });
    return generation;
  });
}
