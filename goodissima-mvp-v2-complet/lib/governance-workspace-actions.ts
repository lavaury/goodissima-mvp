"use server";

import { redirect } from "next/navigation";
import type { WorkspaceCategory, WorkspaceKind } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import {
  getRealGovernanceWorkspaceSummaries,
  type RealGovernanceWorkspaceSummary,
} from "@/lib/governance-workspace-repository";
import { prisma } from "@/lib/prisma";

const workspaceCategories = new Set<WorkspaceCategory>([
  "PROFESSIONAL",
  "PRIVATE",
  "FAMILY",
  "ASSOCIATION",
  "PROJECT",
  "CLIENT",
  "OTHER",
]);

const workspaceKinds = new Set<WorkspaceKind>(["GOVERNANCE", "RELATION", "MIXED"]);

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

async function uniqueWorkspaceSlug(ownerId: string, base: string) {
  const normalizedBase = workspaceSlugFrom(base) || "workspace";

  for (let index = 0; index < 8; index += 1) {
    const slug = index === 0 ? normalizedBase : `${normalizedBase}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 90);
    const existing = await prisma.workspace.findUnique({
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

export async function listCurrentUserGovernanceWorkspacesAction(): Promise<RealGovernanceWorkspaceSummary[]> {
  const owner = await getCurrentPrismaUser();
  return getRealGovernanceWorkspaceSummaries(owner.id);
}

export async function createWorkspaceAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const name = textFromForm(formData, "name");
  const description = textFromForm(formData, "description");
  const categoryInput = textFromForm(formData, "category") as WorkspaceCategory;
  const kindInput = textFromForm(formData, "kind") as WorkspaceKind;

  if (name.length < 2) {
    throw new Error("Le nom du Workspace est obligatoire.");
  }

  const category = workspaceCategories.has(categoryInput) ? categoryInput : "OTHER";
  const kind = workspaceKinds.has(kindInput) ? kindInput : "GOVERNANCE";
  const slug = await uniqueWorkspaceSlug(owner.id, name);

  await prisma.workspace.create({
    data: {
      ownerId: owner.id,
      slug,
      name,
      description: description || null,
      category,
      kind,
      status: "ACTIVE",
      metadata: {
        source: "workspace-product-create-v1",
      },
    },
  });

  redirect("/gouvernance");
}
