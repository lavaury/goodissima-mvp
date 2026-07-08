import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { generateTemplateDraft, type TemplateDesignerDraft } from "@/lib/ai/template-designer";

const confidentialityRules = [
  "Limiter l'acces aux personnes impliquees dans le parcours.",
  "Conserver une validation humaine avant publication ou invitation.",
  "Ne pas contacter automatiquement les participants.",
  "Ne declencher aucune publication ni aucun workflow automatiquement.",
];

function firstActionsFromDraft(draft: TemplateDesignerDraft) {
  const relationalActions = draft.relationalRequests.map((request) => ({
    title: request.title,
    owner: request.targetActor ?? "Createur du parcours",
    dueHint: request.deadline,
  }));

  if (relationalActions.length > 0) return relationalActions;

  return draft.stages.map((stage) => ({
    title: stage.expectedAction || stage.name,
    owner: stage.responsibleActor ?? "Createur du parcours",
    dueHint: stage.deadline,
  }));
}

export async function POST(req: Request) {
  try {
    const owner = await getCurrentPrismaUser();
    const body = await req.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const workspaceId = typeof body.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : `workspace-${owner.id}`;
    const workspaceName =
      typeof body.workspaceName === "string" && body.workspaceName.trim()
        ? body.workspaceName.trim()
        : "Workspace saisi en creation V1";

    if (description.length < 20) {
      return NextResponse.json({ error: "Decrivez le besoin en au moins 20 caracteres." }, { status: 400 });
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: "La description est limitee a 5 000 caracteres." }, { status: 400 });
    }

    const result = await generateTemplateDraft(description, {
      userId: owner.id,
      organizationId: owner.id,
      organizationName: owner.name ?? owner.email,
    });
    const { draft, provenance } = result;

    return NextResponse.json({
      status: "GENERATED",
      persistence: "NONE_BEFORE_HUMAN_VALIDATION",
      requiresHumanValidation: true,
      provenance,
      proposal: {
        name: draft.name,
        initialNeed: description,
        objective: draft.description,
        workspaceId,
        workspaceName,
        participants: draft.actors,
        documents: draft.documents.map((document) => ({
          name: document.name,
          reason: "Document attendu dans le cadrage propose par l'assistance IA.",
          required: document.required,
        })),
        confidentialityRules,
        firstActions: firstActionsFromDraft(draft),
        rationale: "Proposition structuree par l'assistance IA depuis le besoin libre. Elle doit etre relue et validee avant creation.",
      },
    });
  } catch (error) {
    console.error("[governance-journey-ai-generate] generation failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN_ERROR",
    });
    return NextResponse.json({ error: "Impossible de generer la proposition IA." }, { status: 500 });
  }
}
