"use server";

import type { Prisma, WorkspaceCategory } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { createGovernedJourneyExtensionInTransaction } from "@/lib/governed-journey/create-extension";
import { prisma } from "@/lib/prisma";

type GovernanceJourneyActor = {
  name: string;
  role: string;
};

type GovernanceJourneyDocument = {
  name: string;
  reason: string;
  required: boolean;
};

type GovernanceJourneyAction = {
  title: string;
  owner: string;
  dueHint?: string;
};

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function linesFromForm(formData: FormData, key: string) {
  return textFromForm(formData, key)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type GovernanceJourneyCreationErrorCode = "INVALID_INPUT" | "NOT_FOUND" | "CREATION_CONFLICT" | "GOVERNED_JOURNEY_CREATION_FAILED";

class GovernanceJourneyCreationError extends Error {
  constructor(public readonly code: GovernanceJourneyCreationErrorCode) {
    super(code);
    this.name = "GovernanceJourneyCreationError";
  }
}

const forbiddenStructuralFields = [
  "governedJourneyId", "relationTemplateId", "formTemplateId", "createdFromTemplateVersionId",
  "authorityUserId", "relationCaseId", "status", "currentStepKey", "createdByUserId",
] as const;

function invalidInput(): never {
  throw new GovernanceJourneyCreationError("INVALID_INPUT");
}

function boundedText(formData: FormData, key: string, minimum: number, maximum: number, optional = false) {
  const value = textFromForm(formData, key);
  if ((!value && !optional) || value.length > maximum || (value && value.length < minimum)) invalidInput();
  return value;
}

function boundedLines(formData: FormData, key: string, maximumLength: number, maximumItems: number, maximumItemLength: number) {
  const raw = textFromForm(formData, key);
  if (raw.length > maximumLength) invalidInput();
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > maximumItems || lines.some((line) => line.length > maximumItemLength)) invalidInput();
  return lines;
}

function validateCreationPayload(formData: FormData) {
  if (forbiddenStructuralFields.some((field) => formData.has(field))) invalidInput();
  const category = boundedText(formData, "workspaceCategory", 0, 32, true) as WorkspaceCategory;
  if (category && !workspaceCategories.has(category)) invalidInput();
  const workspaceId = boundedText(formData, "workspaceId", 0, 191, true);
  if (workspaceId && !/^[A-Za-z0-9_-]+$/.test(workspaceId)) invalidInput();

  return {
    name: boundedText(formData, "name", 2, 120),
    initialNeed: boundedText(formData, "initialNeed", 10, 2_000),
    objective: boundedText(formData, "objective", 0, 2_000, true),
    workspaceId,
    workspaceName: boundedText(formData, "workspaceName", 0, 120, true),
    workspaceCategory: category || "OTHER" as WorkspaceCategory,
    participants: boundedLines(formData, "participants", 1_000, 20, 200),
    documents: boundedLines(formData, "documents", 1_000, 20, 200),
    confidentialityRules: boundedLines(formData, "confidentialityRules", 2_000, 20, 300),
    firstActions: boundedLines(formData, "firstActions", 2_000, 20, 300),
    aiProvider: boundedText(formData, "aiProvider", 0, 100, true),
    aiModel: boundedText(formData, "aiModel", 0, 160, true),
    aiPromptVersion: boundedText(formData, "aiPromptVersion", 0, 100, true),
  };
}

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function csvWords(value: string) {
  return value
    .split(/[\s,;:.!?()[\]"']+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 3);
}

function titleFromNeed(need: string) {
  const words = csvWords(need).slice(0, 8).join(" ");
  return words ? `Parcours ${words}`.slice(0, 120) : "Parcours gouverne";
}

function uniqueLines(lines: string[], limit: number) {
  const seen = new Set<string>();
  return lines
    .map((line) => line.trim())
    .filter((line) => {
      const key = line.toLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 56);
}

function workspaceSlugFrom(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function workspaceNameFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fieldKeyFromLabel(label: string, fallback: string) {
  const key = normalizeKey(label).toLowerCase();
  return key || fallback;
}

const workspaceCategories = new Set<WorkspaceCategory>([
  "PROFESSIONAL",
  "PRIVATE",
  "FAMILY",
  "ASSOCIATION",
  "PROJECT",
  "CLIENT",
  "OTHER",
]);

async function uniqueRelationTemplateKey(base: string) {
  const prefix = base || "PARCOURS_GOUVERNE";

  for (let index = 0; index < 5; index += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const key = `${prefix}_${suffix}`.slice(0, 80);
    const existing = await prisma.relationTemplate.findUnique({ where: { key }, select: { id: true } });
    if (!existing) return key;
  }

  return `${prefix}_${Date.now().toString(36).toUpperCase()}`.slice(0, 80);
}

export type GovernanceJourneyProposal = {
  name: string;
  initialNeed: string;
  objective: string;
  workspaceId: string;
  workspaceName: string;
  participants: GovernanceJourneyActor[];
  documents: GovernanceJourneyDocument[];
  confidentialityRules: string[];
  firstActions: GovernanceJourneyAction[];
  rationale: string;
};

export async function proposeGovernedJourneyAction(formData: FormData): Promise<GovernanceJourneyProposal> {
  const owner = await getCurrentPrismaUser();
  const initialNeed = textFromForm(formData, "aiNeed");
  const workspaceId = textFromForm(formData, "workspaceId") || `workspace-${owner.id}`;
  const workspaceName = textFromForm(formData, "workspaceName") || "Workspace saisi en creation V1";

  if (initialNeed.length < 10) {
    throw new Error("Decrivez le besoin en au moins 10 caracteres.");
  }

  const name = titleFromNeed(initialNeed);
  const documentHints = uniqueLines(
    [
      ...Array.from(initialNeed.matchAll(/(?:document|piece|justificatif|contrat|attestation|rapport|dossier)[a-zA-Z0-9_\- ]*/gi)).map(
        ([match]) => match,
      ),
      "Synthese du besoin validee",
      "Elements transmis par les participants",
    ],
    4,
  );
  const participantHints = uniqueLines(
    [
      ...Array.from(initialNeed.matchAll(/(?:client|candidat|partenaire|expert|manager|responsable|participant|fournisseur)[a-zA-Z0-9_\- ]*/gi)).map(
        ([match]) => match,
      ),
      "Responsable du parcours",
      "Participant concerne",
    ],
    4,
  );

  const objective = `Organiser un parcours gouverne pour traiter le besoin suivant : ${initialNeed}`;
  const participants = participantHints.map((participant, index) => ({
    name: participant,
    role: index === 0 ? "Responsable de coordination" : "Participant attendu",
  }));
  const documents = documentHints.map((document) => ({
    name: document,
    reason: "Element utile au cadrage et a la validation humaine.",
    required: true,
  }));
  const confidentialityRules = [
    "Limiter l'acces aux personnes impliquees dans le parcours.",
    "Conserver une validation humaine avant publication ou invitation.",
    "Ne pas contacter automatiquement les participants.",
  ];
  const firstActions: GovernanceJourneyAction[] = [
    { title: "Relire et valider le cadrage", owner: "Createur du parcours" },
    { title: "Confirmer les participants attendus", owner: "Createur du parcours" },
    { title: "Verifier les documents necessaires", owner: "Createur du parcours" },
  ];

  return {
    name,
    initialNeed,
    objective,
    workspaceId,
    workspaceName,
    participants,
    documents,
    confidentialityRules,
    firstActions,
    rationale: "Proposition generee depuis le besoin libre saisi. Elle doit etre validee ou corrigee avant creation.",
  };
}

export async function createGovernedJourneyAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const payload = validateCreationPayload(formData);
  const {
    name, initialNeed, workspaceId, workspaceName, workspaceCategory, participants, documents,
    confidentialityRules, firstActions, aiProvider, aiModel, aiPromptVersion,
  } = payload;
  const objective = payload.objective || initialNeed;
  const requestedWorkspace = workspaceName || `workspace-${owner.id}`;
  const workspaceSlug = workspaceSlugFrom(requestedWorkspace) || `workspace-${owner.id.toLowerCase()}`;
  const resolvedWorkspaceName = workspaceName || workspaceNameFromSlug(workspaceSlug) || "Workspace Goodissima";

  const key = await uniqueRelationTemplateKey(normalizeKey(name));
  const formKey = `${key}_FORM`.slice(0, 80);
  const now = new Date().toISOString();
  const intent = {
    intentId: `intent-${key.toLowerCase()}`,
    accountId: owner.id,
    workspaceId: workspaceSlug,
    initialNeed,
    status: "Captured",
    createdAt: now,
    updatedAt: now,
  };
  const proposal: {
    proposalId: string;
    intent: typeof intent;
    proposedBy: "AI";
    objective: string;
    actors: GovernanceJourneyActor[];
    expectedDocuments: GovernanceJourneyDocument[];
    confidentialityRules: string[];
    discoveryInvitations: [];
    firstActions: GovernanceJourneyAction[];
    recommendedWorkspaceId: string;
    recommendedWorkspaceName: string;
    rationale: string;
    createdAt: string;
  } = {
    proposalId: `proposal-${key.toLowerCase()}`,
    intent,
    proposedBy: "AI",
    objective,
    actors: participants.map((participant) => ({ name: participant, role: "Participant attendu" })),
    expectedDocuments: documents.map((document) => ({
      name: document,
      reason: "Document attendu saisi ou valide avant creation.",
      required: true,
    })),
    confidentialityRules:
      confidentialityRules.length > 0
        ? confidentialityRules
        : [
            "Limiter l'acces aux personnes impliquees dans le parcours.",
            "Conserver une validation humaine avant publication ou invitation.",
          ],
    discoveryInvitations: [],
    firstActions:
      firstActions.length > 0
        ? firstActions.map((action) => ({ title: action, owner: "Createur du parcours" }))
        : [{ title: "Relire le parcours avant publication", owner: "Createur du parcours" }],
    recommendedWorkspaceId: workspaceSlug,
    recommendedWorkspaceName: resolvedWorkspaceName,
    rationale: "Creation issue d'une validation humaine V1.",
    createdAt: now,
  };
  const draft = {
    draftId: `draft-${key.toLowerCase()}`,
    intentId: intent.intentId,
    proposalId: proposal.proposalId,
    correctedBy: owner.id,
    initialNeed,
    objective,
    actors: proposal.actors,
    expectedDocuments: proposal.expectedDocuments,
    confidentialityRules: proposal.confidentialityRules,
    discoveryInvitations: [],
    firstActions: proposal.firstActions,
    workspaceId: workspaceSlug,
    workspaceName: resolvedWorkspaceName,
    correctionNotes: [],
    createdAt: now,
  };
  const validation = {
    validationId: `validation-${key.toLowerCase()}`,
    intentId: intent.intentId,
    proposalId: proposal.proposalId,
    draftId: draft.draftId,
    validatedBy: owner.id,
    humanValidated: true,
    initialNeed,
    validatedObjective: objective,
    workspaceId: draft.workspaceId,
    validatedAt: now,
  };
  const plan: {
    journeyId: string;
    workspaceId: string;
    intentId: string;
    proposalId: string;
    draftId: string;
    validationId: string;
    title: string;
    objective: string;
    actors: GovernanceJourneyActor[];
    expectedDocuments: GovernanceJourneyDocument[];
    confidentialityRules: string[];
    discoveryInvitations: [];
    firstActions: GovernanceJourneyAction[];
    initialNeed: string;
    createdBy: string;
    createdAt: string;
    source: "HumanValidatedIntent";
  } = {
    journeyId: key.toLowerCase(),
    workspaceId: draft.workspaceId,
    intentId: intent.intentId,
    proposalId: proposal.proposalId,
    draftId: draft.draftId,
    validationId: validation.validationId,
    title: objective,
    objective,
    actors: draft.actors,
    expectedDocuments: draft.expectedDocuments,
    confidentialityRules: draft.confidentialityRules,
    discoveryInvitations: [],
    firstActions: draft.firstActions,
    initialNeed,
    createdBy: owner.id,
    createdAt: now,
    source: "HumanValidatedIntent",
  };

  const stages = [
    {
      name: "Expression du besoin",
      objective,
      responsibleActor: "Createur du parcours",
      expectedAction: "Qualifier le besoin et preparer le parcours.",
      exitCondition: "Le parcours est pret pour validation humaine.",
    },
    ...plan.firstActions.map((action) => ({
      name: action.title,
      objective: action.dueHint ?? "Action initiale validee dans le cadrage.",
      responsibleActor: action.owner,
      expectedAction: action.title,
      exitCondition: "Action traitee ou planifiee.",
    })),
  ];
  const actors = participants.map((participant) => ({ name: participant, role: "Participant attendu" }));
  const journeyDocuments = documents.map((document) => ({ name: document, required: true, stage: 1 }));
  const design = {
    actors,
    stages,
    documents: journeyDocuments,
    relationalRequests: plan.firstActions.map((action, index) => ({
      title: action.title,
      description: action.dueHint ?? "Premiere action validee avant creation.",
      stage: Math.min(index + 2, Math.max(stages.length, 1)),
      targetActor: action.owner,
    })),
    kpis: [],
  };

  let formTemplateId: string;
  try {
    formTemplateId = await prisma.$transaction(async (tx) => {
      const selectedWorkspace = workspaceId
      ? await tx.workspace.findFirst({
          where: {
            id: workspaceId,
            ownerId: owner.id,
            status: "ACTIVE",
          },
        })
      : null;

      if (workspaceId && !selectedWorkspace) throw new GovernanceJourneyCreationError("NOT_FOUND");

      let workspace = selectedWorkspace;
      if (!workspace) {
        workspace = await tx.workspace.findUnique({
          where: { ownerId_slug: { ownerId: owner.id, slug: workspaceSlug } },
        });
        if (workspace && workspace.status !== "ACTIVE") throw new GovernanceJourneyCreationError("NOT_FOUND");
        if (!workspace) {
          workspace = await tx.workspace.create({
            data: {
              ownerId: owner.id,
              slug: workspaceSlug,
              name: resolvedWorkspaceName,
              kind: "GOVERNANCE",
              category: workspaceCategory,
              status: "ACTIVE",
              metadata: {
                source: "governance-v1-minimal-create",
                createdFrom: "createGovernedJourneyAction",
              },
            },
          });
        }
      }

      if (workspace.ownerId !== owner.id || workspace.status !== "ACTIVE") {
        throw new GovernanceJourneyCreationError("NOT_FOUND");
      }

    const relationTemplate = await tx.relationTemplate.create({
      data: {
        workspaceId: workspace.id,
        key,
        name,
        description: initialNeed,
        status: "DRAFT",
      },
    });

    const createdFormTemplate = await tx.formTemplate.create({
      data: {
        key: formKey,
        name,
        description: initialNeed,
        relationTemplateId: relationTemplate.id,
      },
    });

    const fields = [
      {
        formTemplateId: createdFormTemplate.id,
        key: "initialNeed",
        label: "Besoin initial",
        type: "TEXTAREA",
        required: true,
        step: 1,
        position: 1,
        placeholder: null,
        defaultValue: null,
      },
      ...documents.map((document, index) => ({
        formTemplateId: createdFormTemplate.id,
        key: fieldKeyFromLabel(document, `document_${index + 1}`),
        label: document,
        type: "FILE",
        required: true,
        step: 1,
        position: index + 2,
        placeholder: null,
        defaultValue: null,
      })),
    ];

    await tx.formField.createMany({ data: fields });

    const snapshot = {
      relationTemplate: {
        id: relationTemplate.id,
        key: relationTemplate.key,
        name: relationTemplate.name,
        description: relationTemplate.description,
      },
      formTemplate: {
        id: createdFormTemplate.id,
        key: createdFormTemplate.key,
        name: createdFormTemplate.name,
        description: createdFormTemplate.description,
      },
      fields: fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        defaultValue: field.defaultValue,
        step: field.step,
        options: null,
        conditionalRules: null,
        validationRules: null,
      })),
      design,
      metadata: {
        snapshotVersion: 2,
        lifecycle: "DRAFT",
        source: "governance-v1-minimal-create",
        intent: { ...intent, status: "JourneyCreationPlanned", updatedAt: now },
        proposal,
        draft,
        humanValidation: validation,
        creationPlan: plan,
        confidentialityRules,
        aiProvenance:
          aiProvider || aiModel || aiPromptVersion
            ? {
                provider: aiProvider || "unknown",
                model: aiModel || "unknown",
                promptVersion: aiPromptVersion || "unknown",
              }
            : null,
        requiresHumanValidation: true,
        createdById: owner.id,
        createdAt: now,
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        workspaceName: workspace.name,
        workspaceCategory: workspace.category,
        workspacePersistence: "prisma-workspace-v1",
        automaticPublication: false,
        automaticWorkflowExecution: false,
        automaticContact: false,
      },
    } satisfies Prisma.InputJsonObject;

    const templateVersion = await tx.templateVersion.create({
      data: {
        templateId: relationTemplate.id,
        version: 1,
        name,
        description: initialNeed,
        snapshot,
        isPublished: false,
      },
    });

      await createGovernedJourneyExtensionInTransaction({
        tx,
        relationTemplateId: relationTemplate.id,
        formTemplateId: createdFormTemplate.id,
        templateVersionId: templateVersion.id,
        authorityUserId: workspace.ownerId,
        title: createdFormTemplate.name,
      });

      return createdFormTemplate.id;
    });
  } catch (error) {
    if (error instanceof GovernanceJourneyCreationError) throw error;
    if (isUniqueConflict(error)) throw new GovernanceJourneyCreationError("CREATION_CONFLICT");
    throw new GovernanceJourneyCreationError("GOVERNED_JOURNEY_CREATION_FAILED");
  }

  redirect(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
