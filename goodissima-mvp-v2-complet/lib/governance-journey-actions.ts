"use server";

import type { Prisma, WorkspaceCategory } from "@prisma/client";
import { redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
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
  const name = textFromForm(formData, "name");
  const initialNeed = textFromForm(formData, "initialNeed");
  const objective = textFromForm(formData, "objective") || initialNeed;
  const workspaceId = textFromForm(formData, "workspaceId");
  const workspaceName = textFromForm(formData, "workspaceName");
  const workspaceCategoryInput = textFromForm(formData, "workspaceCategory") as WorkspaceCategory;
  const participants = linesFromForm(formData, "participants");
  const documents = linesFromForm(formData, "documents");
  const confidentialityRules = linesFromForm(formData, "confidentialityRules");
  const firstActions = linesFromForm(formData, "firstActions");
  const requiresHumanValidation = textFromForm(formData, "requiresHumanValidation") === "true";
  const aiProvider = textFromForm(formData, "aiProvider");
  const aiModel = textFromForm(formData, "aiModel");
  const aiPromptVersion = textFromForm(formData, "aiPromptVersion");

  if (!name || !initialNeed) {
    throw new Error("Le nom du parcours et le besoin initial sont obligatoires.");
  }

  const workspaceCategory = workspaceCategories.has(workspaceCategoryInput) ? workspaceCategoryInput : "OTHER";
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

  const formTemplate = await prisma.$transaction(async (tx) => {
    const selectedWorkspace = workspaceId
      ? await tx.workspace.findFirst({
          where: {
            id: workspaceId,
            ownerId: owner.id,
          },
        })
      : null;

    if (workspaceId && !selectedWorkspace) {
      throw new Error("Workspace introuvable pour cet utilisateur.");
    }

    const workspace =
      selectedWorkspace ??
      (await tx.workspace.upsert({
        where: {
          ownerId_slug: {
            ownerId: owner.id,
            slug: workspaceSlug,
          },
        },
        update: {
          status: "ACTIVE",
        },
        create: {
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
      }));

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
        requiresHumanValidation,
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

    await tx.templateVersion.create({
      data: {
        templateId: relationTemplate.id,
        version: 1,
        name,
        description: initialNeed,
        snapshot,
        isPublished: false,
      },
    });

    return createdFormTemplate;
  });

  redirect(`/gouvernance/parcours/${formTemplate.id}/pilotage`);
}
