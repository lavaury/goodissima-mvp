"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

export async function attachGovernedJourneyToWorkspaceAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const workspaceId = textFromForm(formData, "workspaceId");

  if (!formTemplateId || !workspaceId) {
    throw new Error("Le parcours et le Workspace cible sont obligatoires.");
  }

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: {
      relationTemplate: {
        include: {
          workspace: {
            select: {
              ownerId: true,
            },
          },
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!formTemplate?.relationTemplate) {
    throw new Error("Parcours gouverne introuvable.");
  }

  const latestVersion = formTemplate.relationTemplate.versions[0];
  if (!latestVersion) {
    throw new Error("Version du parcours introuvable.");
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      ownerId: owner.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
    },
  });

  if (!workspace) {
    throw new Error("Workspace cible introuvable pour cet utilisateur.");
  }

  const snapshot = asRecord(latestVersion.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const creationPlan = asRecord(metadata.creationPlan);
  const metadataOwnerId = typeof metadata.createdById === "string" ? metadata.createdById : null;
  const alreadyAttachedToOwner = formTemplate.relationTemplate.workspace?.ownerId === owner.id;

  if (metadataOwnerId !== owner.id && !alreadyAttachedToOwner) {
    throw new Error("Ce parcours ne peut pas etre rattache par cet utilisateur.");
  }

  const now = new Date().toISOString();
  const nextMetadata = {
    ...metadata,
    workspaceId: workspace.id,
    workspaceSlug: workspace.slug,
    workspaceName: workspace.name,
    workspaceCategory: workspace.category,
    workspacePersistence: "prisma-workspace-v1-manual-attachment",
    workspaceAttachedAt: now,
    workspaceAttachedById: owner.id,
    creationPlan: {
      ...creationPlan,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    },
  };

  await prisma.$transaction(async (tx) => {
    await tx.relationTemplate.update({
      where: { id: formTemplate.relationTemplate!.id },
      data: { workspaceId: workspace.id },
    });

    await tx.templateVersion.update({
      where: { id: latestVersion.id },
      data: {
        snapshot: {
          ...snapshot,
          metadata: nextMetadata,
        },
      },
    });
  });

  revalidatePath("/gouvernance");
  revalidatePath(`/gouvernance/parcours/${formTemplateId}/pilotage`);
  redirect("/gouvernance");
}
