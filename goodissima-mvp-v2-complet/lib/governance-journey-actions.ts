"use server";

import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCreationWorkspaceId } from "@/lib/object-creation";
import { createJourneyRootAndCreated, createdJourneyReadbackMatches, journeyCreationTemplateKey } from "@/lib/governed-journey-root-creation";

type GovernanceJourneyActor = {
  roleId?: string;
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

function participantActorsFromLines(lines: string[]): GovernanceJourneyActor[] {
  return lines.map((line, index) => {
    const separator = line.lastIndexOf(" - ");
    if (separator <= 0 || separator >= line.length - 3) return { roleId: `expected-role-${index + 1}`, name: line, role: "Participant attendu" };
    return { roleId: `expected-role-${index + 1}`, name: line.slice(0, separator).trim(), role: line.slice(separator + 3).trim() };
  });
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

function fieldKeyFromLabel(label: string, fallback: string) {
  const key = normalizeKey(label).toLowerCase();
  return key || fallback;
}

const requestKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isUniqueConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function creationFailureCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code : "UNCLASSIFIED";
}

export type GovernanceJourneyProposal = {
  name: string;
  initialNeed: string;
  objective: string;
  workspaceId: string | null;
  workspaceName: string | null;
  participants: GovernanceJourneyActor[];
  documents: GovernanceJourneyDocument[];
  confidentialityRules: string[];
  firstActions: GovernanceJourneyAction[];
  rationale: string;
};

export async function proposeGovernedJourneyAction(formData: FormData): Promise<GovernanceJourneyProposal> {
  const owner = await getCurrentPrismaUser();
  const initialNeed = textFromForm(formData, "aiNeed");
  const workspaceValues = formData.getAll("workspaceId");
  if (workspaceValues.length > 1) throw new Error("Workspace invalide.");
  const workspaceId = parseCreationWorkspaceId(workspaceValues[0]);
  const workspace = workspaceId ? await prisma.workspace.findFirst({ where: { id: workspaceId, ownerId: owner.id, status: "ACTIVE" } }) : null;
  if (workspaceId && !workspace) throw new Error("Workspace introuvable pour cet utilisateur.");
  const workspaceName = workspace?.name ?? null;

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
  const requestKeys = formData.getAll("requestKey");
  if (requestKeys.length !== 1 || typeof requestKeys[0] !== "string"
    || !requestKeyPattern.test(requestKeys[0])) throw new Error("Demande de création invalide. Rechargez la page.");
  const requestKey = requestKeys[0];
  const name = textFromForm(formData, "name");
  const initialNeed = textFromForm(formData, "initialNeed");
  const objective = textFromForm(formData, "objective") || initialNeed;
  const workspaceValues = formData.getAll("workspaceId");
  if (workspaceValues.length > 1) throw new Error("Workspace invalide.");
  const workspaceId = parseCreationWorkspaceId(workspaceValues[0]);
  const participants = linesFromForm(formData, "participants");
  const participantActors = participantActorsFromLines(participants);
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

  // A repeated submit of this form keeps the same template key. Different
  // submissions remain distinct, even when their business content matches.
  const key = journeyCreationTemplateKey(owner.id, requestKey);
  const journeyId = randomUUID();
  const requestFingerprint = createHash("sha256").update(JSON.stringify({
    name, initialNeed, objective, workspaceId, participants, documents,
    confidentialityRules, firstActions, requiresHumanValidation,
    aiProvider, aiModel, aiPromptVersion,
  })).digest("hex");
  const formKey = `${key}_FORM`.slice(0, 80);
  const now = new Date().toISOString();
  const intent = {
    intentId: `intent-${key.toLowerCase()}`,
    accountId: owner.id,
    workspaceId,
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
    recommendedWorkspaceId: string | null;
    recommendedWorkspaceName: string | null;
    rationale: string;
    createdAt: string;
  } = {
    proposalId: `proposal-${key.toLowerCase()}`,
    intent,
    proposedBy: "AI",
    objective,
    actors: participantActors,
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
    recommendedWorkspaceId: workspaceId,
    recommendedWorkspaceName: null,
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
    workspaceId,
    workspaceName: null,
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
    workspaceId: string | null;
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
    journeyId,
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
  const actors = participantActors;
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

  let created: Awaited<ReturnType<typeof createJourneyRootAndCreated>> | null = null;
  let formTemplateId: string | null = null;
  try {
    const result = await prisma.$transaction(async (tx) => {
    const selectedWorkspace = workspaceId
      ? await tx.workspace.findFirst({
          where: {
            id: workspaceId,
            ownerId: owner.id,
            status: "ACTIVE",
          },
        })
      : null;

    if (workspaceId && !selectedWorkspace) {
      throw new Error("Workspace introuvable pour cet utilisateur.");
    }

    const workspace = selectedWorkspace;

    const relationTemplate = await tx.relationTemplate.create({
      data: {
        workspaceId: workspace?.id ?? null,
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
        proposal: { ...proposal, recommendedWorkspaceName: workspace?.name ?? null },
        draft: { ...draft, workspaceName: workspace?.name ?? null },
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
        creationRequestFingerprint: requestFingerprint,
        createdAt: now,
        workspaceId: workspace?.id ?? null,
        workspaceSlug: workspace?.slug ?? null,
        workspaceName: workspace?.name ?? null,
        workspaceCategory: workspace?.category ?? null,
        workspacePersistence: workspace ? "prisma-workspace-v1" : null,
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

    // Keep this as the final business DB operation of the transaction.
    const journey = await createJourneyRootAndCreated(tx, {
      id: journeyId,
      relationTemplateId: relationTemplate.id,
      formTemplateId: createdFormTemplate.id,
      createdFromTemplateVersionId: templateVersion.id,
      relationCaseId: null,
      authorityUserId: owner.id,
      title: name,
    });
    return { journey, formTemplateId: createdFormTemplate.id };
    });
    created = result.journey;
    formTemplateId = result.formTemplateId;
  } catch (error) {
    if (error instanceof Error && error.message === "Workspace introuvable pour cet utilisateur.") throw error;
    if (!isUniqueConflict(error)) {
      console.error("Governed Journey creation transaction failed", { code: creationFailureCode(error) });
      throw new Error("La création du parcours n'a pas pu être enregistrée. Réessayez.");
    }
    // The unique template key is stable for this form submission. Recover a
    // previously committed result only if its snapshot matches this request.
    const existing = await prisma.relationTemplate.findUnique({ where: { key }, select: { id: true } });
    if (!existing) {
      console.error("Governed Journey creation unique conflict without matching template");
      throw new Error("La création du parcours n'a pas pu être enregistrée. Réessayez.");
    }
    const version = await prisma.templateVersion.findFirst({
      where: { templateId: existing.id, version: 1 }, select: { snapshot: true },
    });
    const metadata = version?.snapshot && typeof version.snapshot === "object"
      && !Array.isArray(version.snapshot) && "metadata" in version.snapshot
      ? version.snapshot.metadata : null;
    const fingerprint = metadata && typeof metadata === "object" && !Array.isArray(metadata)
      && "creationRequestFingerprint" in metadata ? metadata.creationRequestFingerprint : null;
    if (fingerprint !== requestFingerprint) {
      throw new Error("Cette demande de création a déjà été utilisée avec un autre contenu.");
    }
    const journey = await prisma.governedJourney.findUnique({
      where: { relationTemplateId: existing.id }, select: {
        id: true, relationTemplateId: true, formTemplateId: true, authorityUserId: true, relationCaseId: true,
      },
    });
    if (!journey || !journey.formTemplateId || journey.authorityUserId !== owner.id) {
      console.error("Governed Journey duplicate request missing committed root");
      throw new Error("La création du parcours n'a pas pu être confirmée. Réessayez.");
    }
    created = { ...journey, formTemplateId: journey.formTemplateId };
    formTemplateId = journey.formTemplateId;
  }

  if (!created || !formTemplateId) throw new Error("La création du parcours n'a pas pu être confirmée.");
  const readback = await prisma.governedJourney.findUnique({ where: { id: created.id }, select: {
    id: true, relationTemplateId: true, formTemplateId: true, authorityUserId: true,
    relationCaseId: true, status: true,
    events: { select: { type: true, sequence: true, fromStatus: true, toStatus: true,
      actorUserId: true, authorityUserId: true, relationCaseId: true } },
  } }).catch((error: unknown) => {
    console.error("Governed Journey creation read-back query failed", { code: creationFailureCode(error) });
    throw new Error("La création du parcours n'a pas pu être confirmée. Réessayez.");
  });
  if (!createdJourneyReadbackMatches(readback, created)) {
    console.error("Governed Journey creation read-back failed", {
      journeyId: created.id, relationTemplateId: created.relationTemplateId,
    });
    throw new Error("La création du parcours n'a pas pu être confirmée. Réessayez.");
  }

  if (workspaceId) revalidatePath(`/gouvernance/workspaces/${encodeURIComponent(workspaceId)}`);
  redirect(`/gouvernance/parcours/${formTemplateId}/pilotage`);
}
