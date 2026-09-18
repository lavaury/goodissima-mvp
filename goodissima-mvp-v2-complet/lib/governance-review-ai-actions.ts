"use server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getAIUserError, routeAI } from "@/lib/ai/governance/router";
import { prisma } from "@/lib/prisma";

export type GovernanceReviewAIHelp = { summary: string; pointsToExamine: string[]; blockers: string[]; questionsToDecide: string[]; humanActions: string[]; limits: string[] };
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim().slice(0, 700)).slice(0, 12) : []; }
function parse(content: string): GovernanceReviewAIHelp { const row = JSON.parse(content.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()) as Record<string, unknown>; return { summary: typeof row.summary === "string" ? row.summary.trim().slice(0, 3000) : "", pointsToExamine: strings(row.pointsToExamine), blockers: strings(row.blockers), questionsToDecide: strings(row.questionsToDecide), humanActions: strings(row.humanActions), limits: strings(row.limits) }; }

export async function prepareGovernanceReviewWithAIAssistantAction(input: { formTemplateId: string; reason: string; question: string; humanNote?: string | null }): Promise<{ help?: GovernanceReviewAIHelp; error?: string }> {
  const owner = await getCurrentPrismaUser();
  const form = await prisma.formTemplate.findFirst({ where: { id: input.formTemplateId, relationTemplate: { workspace: { ownerId: owner.id } } }, select: { name: true, description: true, relationTemplate: { select: { id: true, name: true, description: true, governedJourneyInvitations: { select: { displayName: true, role: true, status: true, accessTokenExpiresAt: true, revokedAt: true, acceptedAt: true, consent: { select: { status: true } } } }, communicationSessions: { select: { id: true, title: true, purpose: true, status: true, scheduledAt: true, meetingParticipants: { where: { status: "AUTHORIZED" }, select: { governedJourneyInvitation: { select: { displayName: true } } } } } } } } } });
  if (!form?.relationTemplate) return { error: "Parcours gouverné introuvable." };
  const now = new Date();
  const context = { journey: { title: form.relationTemplate.name || form.name, objective: form.relationTemplate.description || form.description }, review: { reason: input.reason.slice(0, 1000), question: input.question.slice(0, 1000), humanNote: input.humanNote?.slice(0, 2000) || null }, guestAccesses: form.relationTemplate.governedJourneyInvitations.map((item) => ({ displayName: item.displayName, role: item.role, status: item.revokedAt ? "revoked" : item.accessTokenExpiresAt <= now ? "expired" : item.consent?.status === "DECLINED" ? "declined" : item.consent?.status === "PENDING" ? "pending" : item.status === "ACTIVE" && (!item.consent || item.consent.status === "ACCEPTED") ? "active" : "unavailable", consulted: Boolean(item.acceptedAt) })), meetings: form.relationTemplate.communicationSessions.map((item) => ({ title: item.title, objective: item.purpose, status: item.status, scheduledAt: item.scheduledAt?.toISOString() ?? null, authorizedParticipants: item.meetingParticipants.map((participant) => participant.governedJourneyInvitation.displayName) })) };
  try {
    const result = await routeAI({
      capability: "governanceReview", classification: "CONFIDENTIAL", actorId: owner.id, ownerId: owner.id,
      purpose: "governance_review_assistance", promptVersion: "governance-review-v1",
      context: { type: "governance-review", id: form.relationTemplate.id, data: context }, prompt: { reviewRequested: true },
      system: ["Tu aides uniquement à préparer humainement une revue de gouvernance Goodissima.", "Utilise seulement le contexte fourni, sans inventer.", "Ne décide, ne valide et ne déclenche aucune action.", "Retourne uniquement un JSON strict avec summary, pointsToExamine, blockers, questionsToDecide, humanActions, limits. Tous sauf summary sont des tableaux de chaînes.", "N'inclus aucun token, secret, lien, enum technique ou metadata brute."].join("\n"),
      responseFormat: { type: "json_object" }, validateOutput: (output) => parse(output),
    });
    return { help: result.output };
  } catch (error) { return { error: getAIUserError(error) }; }
}
