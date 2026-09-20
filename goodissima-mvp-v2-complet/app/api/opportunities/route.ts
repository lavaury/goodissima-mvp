import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { buildOpportunityRulesV1 } from "@/lib/opportunities/opportunity-projection";
import { parseOpportunityCriteriaV1 } from "@/lib/opportunities/contracts";
import type { Prisma } from "@prisma/client";

const bodyKeys = new Set(["type", "criteria", "title", "description"]);
export async function POST(request: Request) {
  const owner = await getCurrentPrismaUser();
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !bodyKeys.has(key))) throw new Error("INVALID");
    if (body.type !== "OFFER" && body.type !== "NEED") throw new Error("INVALID");
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!title || title.length > 200 || !description || description.length > 3000) throw new Error("INVALID");
    const criteria = parseOpportunityCriteriaV1(body.criteria);
    const rules = buildOpportunityRulesV1({}, { type: body.type, criteria });
    const slug = `${slugify(title) || "opportunite"}-${Math.random().toString(36).slice(2, 7)}`;
    const link = await prisma.gLink.create({ data: {
      ownerId: owner.id, workspaceId: null, templateId: null, templateVersionId: null,
      slug, title, description, city: criteria.locations?.[0] ?? null, status: "DRAFT", rules: rules as Prisma.InputJsonValue,
    }, select: { id: true, slug: true, status: true } });
    revalidatePath("/opportunities"); revalidatePath("/gouvernance"); revalidatePath("/dashboard"); revalidatePath("/");
    return NextResponse.json(link, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
    return NextResponse.json({ error: "Vérifiez les informations de l’opportunité." }, { status: 400 });
  }
}
