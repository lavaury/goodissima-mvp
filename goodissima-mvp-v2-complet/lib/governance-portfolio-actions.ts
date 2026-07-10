"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PortfolioKind } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const portfolioKinds = new Set<PortfolioKind>([
  "JUDICIAL",
  "PROFESSIONAL",
  "ASSOCIATION",
  "FAMILY",
  "PROJECT",
  "PERSONAL",
  "OTHER",
]);

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function slugFrom(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniquePortfolioSlug(ownerId: string, base: string) {
  const normalizedBase = slugFrom(base) || "portfolio";

  for (let index = 0; index < 8; index += 1) {
    const slug = index === 0 ? normalizedBase : `${normalizedBase}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 90);
    const existing = await prisma.portfolio.findUnique({
      where: {
        ownerId_slug: {
          ownerId,
          slug,
        },
      },
      select: { id: true },
    });
    if (!existing) return slug;
  }

  return `${normalizedBase}-${Date.now().toString(36)}`.slice(0, 90);
}

export async function createGovernancePortfolioAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const name = textFromForm(formData, "name");
  const description = textFromForm(formData, "description");
  const kindInput = textFromForm(formData, "kind") as PortfolioKind;

  if (name.length < 2) {
    throw new Error("Le nom du Portfolio est obligatoire.");
  }

  const kind = portfolioKinds.has(kindInput) ? kindInput : "OTHER";
  const slug = await uniquePortfolioSlug(owner.id, name);

  const portfolio = await prisma.portfolio.create({
    data: {
      ownerId: owner.id,
      slug,
      name,
      description: description || null,
      kind,
      status: "ACTIVE",
      metadata: {
        source: "governance-portfolio-v1",
      },
    },
    select: { id: true },
  });

  revalidatePath("/gouvernance");
  redirect(`/gouvernance/portfolios/${portfolio.id}`);
}

export async function attachWorkspaceToPortfolioAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const workspaceId = textFromForm(formData, "workspaceId");
  const portfolioId = textFromForm(formData, "portfolioId");

  if (!workspaceId || !portfolioId) {
    throw new Error("Le Workspace et le Portfolio cible sont obligatoires.");
  }

  const [workspace, portfolio] = await Promise.all([
    prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        ownerId: owner.id,
      },
      select: { id: true },
    }),
    prisma.portfolio.findFirst({
      where: {
        id: portfolioId,
        ownerId: owner.id,
        status: "ACTIVE",
      },
      select: { id: true },
    }),
  ]);

  if (!workspace) {
    throw new Error("Workspace introuvable pour cet utilisateur.");
  }

  if (!portfolio) {
    throw new Error("Portfolio cible introuvable pour cet utilisateur.");
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { portfolioId: portfolio.id },
  });

  revalidatePath("/gouvernance");
  revalidatePath(`/gouvernance/portfolios/${portfolio.id}`);
}

export async function detachWorkspaceFromPortfolioAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const workspaceId = textFromForm(formData, "workspaceId");

  if (!workspaceId) {
    throw new Error("Le Workspace est obligatoire.");
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      ownerId: owner.id,
    },
    select: {
      id: true,
      portfolioId: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace introuvable pour cet utilisateur.");
  }

  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { portfolioId: null },
  });

  revalidatePath("/gouvernance");
  if (workspace.portfolioId) {
    revalidatePath(`/gouvernance/portfolios/${workspace.portfolioId}`);
  }
}
