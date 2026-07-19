import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { rankMatches } from "@/lib/ai/matching";
import { semanticMatchV2 } from "@/lib/ai/semantic-matching";
import {
  hasUsefulGLinkMatchingCriteria,
  matchingProfileFromSource,
  serializeGLinkMatchingAnalysis,
  type RelationalMatchingSource,
} from "@/lib/ai/relational-matching-source";
import { prisma } from "@/lib/prisma";
import { parseGLinkMatchingState } from "@/lib/glink-matching";

async function linkSource(linkId: string, ownerId: string) {
  const link = await prisma.gLink.findFirst({
    where: { id: linkId, ownerId, status: "ACTIVE" },
    select: {
      id: true, ownerId: true, title: true, description: true, templateId: true, rules: true,
      template: {
        select: {
          formTemplates: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { fields: { orderBy: [{ step: "asc" }, { position: "asc" }], select: { label: true, type: true, options: true, validationRules: true } } },
          },
        },
      },
    },
  });
  if (!link) return null;
  const source: Extract<RelationalMatchingSource, { sourceType: "GLINK" }> = {
    sourceType: "GLINK", sourceId: link.id, ownerId: link.ownerId, title: link.title,
    description: link.description, fields: link.template?.formTemplates[0]?.fields ?? [],
  };
  return { link, source };
}

export async function POST(_request: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const resolved = await linkSource(params.linkId, owner.id);
  if (!resolved) return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  if (!parseGLinkMatchingState(resolved.link.rules).enabled) {
    return NextResponse.json({ error: "MATCHING_DISABLED" }, { status: 409 });
  }
  if (!resolved.link.templateId) return NextResponse.json({ error: "Critères insuffisants" }, { status: 409 });
  if (!hasUsefulGLinkMatchingCriteria(resolved.source)) {
    return NextResponse.json({ error: "MATCHING_CRITERIA_INSUFFICIENT" }, { status: 409 });
  }
  const candidateLinks = await prisma.gLink.findMany({
    where: { ownerId: owner.id, status: "ACTIVE", id: { not: resolved.link.id } },
    take: 80,
    select: {
      id: true, ownerId: true, title: true, description: true,
      template: {
        select: {
          formTemplates: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { fields: { orderBy: [{ step: "asc" }, { position: "asc" }], select: { label: true, type: true, options: true, validationRules: true } } },
          },
        },
      },
    },
  });
  const sourceProfile = matchingProfileFromSource(resolved.source);
  const candidates = candidateLinks.map((link, index) => ({
    id: link.id,
    pseudonym: `Opportunité compatible ${index + 1}`,
    templateKey: null,
    profile: matchingProfileFromSource({
      sourceType: "GLINK", sourceId: link.id, ownerId: link.ownerId, title: link.title,
      description: link.description, fields: link.template?.formTemplates[0]?.fields ?? [],
    }),
  }));
  const lexical = rankMatches(sourceProfile, candidates);
  const semantic = semanticMatchV2(sourceProfile, candidates);
  const matches = semantic.length ? semantic : lexical;
  const outputSummary = serializeGLinkMatchingAnalysis({
    sourceType: "GLINK", sourceId: resolved.link.id, matchCount: matches.length, matches,
  });
  await prisma.aIEvent.create({
    data: {
      templateId: resolved.link.templateId, organizationId: owner.id, featureName: "matching_analysis",
      provider: "mock", model: "hybrid-semantic-matching-v2", action: "glink_matching_analysis",
      status: "success", promptVersion: "matching-v1.1-glink", outputSummary,
    },
  });
  return NextResponse.json({ profile: sourceProfile, matches, warnings: [] });
}

export async function PATCH(request: Request, { params }: { params: { linkId: string } }) {
  const owner = await getCurrentPrismaUser();
  const resolved = await linkSource(params.linkId, owner.id);
  if (!resolved?.link.templateId) return NextResponse.json({ error: "Lien introuvable" }, { status: 404 });
  if (!parseGLinkMatchingState(resolved.link.rules).enabled) {
    return NextResponse.json({ error: "MATCHING_DISABLED" }, { status: 409 });
  }
  const body = await request.json();
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const decision = body.decision === "INTERESTING" ? "INTERESTING" : body.decision === "IGNORED" ? "IGNORED" : null;
  if (!targetId || !decision) return NextResponse.json({ error: "Décision invalide" }, { status: 400 });
  await prisma.aIEvent.create({
    data: {
      templateId: resolved.link.templateId, organizationId: owner.id, featureName: "matching_analysis",
      provider: "human", model: "human-review", action: decision === "INTERESTING" ? "glink_matching_interested" : "glink_matching_ignored",
      status: "success", promptVersion: "matching-v1.1-glink",
      outputSummary: JSON.stringify({ sourceType: "GLINK", sourceId: resolved.link.id, targetId, decision }),
    },
  });
  return NextResponse.json({ ok: true });
}
