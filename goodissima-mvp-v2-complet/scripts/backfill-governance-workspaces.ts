import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

async function main() {
  const versions = await prisma.templateVersion.findMany({
    where: {
      snapshot: {
        path: ["metadata", "source"],
        equals: "governance-v1-minimal-create",
      },
    },
    include: {
      template: {
        select: {
          id: true,
          workspaceId: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let updated = 0;
  let skipped = 0;

  for (const version of versions) {
    const snapshot = asRecord(version.snapshot);
    const metadata = asRecord(snapshot.metadata);
    const creationPlan = asRecord(metadata.creationPlan);
    const createdById = text(metadata.createdById);

    if (!createdById) {
      skipped += 1;
      continue;
    }

    const requestedWorkspace =
      text(metadata.workspaceSlug) ??
      text(metadata.workspaceName) ??
      text(metadata.workspaceId) ??
      text(creationPlan.workspaceName) ??
      text(creationPlan.workspaceId) ??
      `workspace-${createdById}`;
    const workspaceSlug = workspaceSlugFrom(requestedWorkspace) || `workspace-${createdById.toLowerCase()}`;
    const workspaceName =
      text(metadata.workspaceName) ??
      text(creationPlan.workspaceName) ??
      workspaceNameFromSlug(workspaceSlug) ??
      "Workspace Goodissima";

    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.upsert({
        where: {
          ownerId_slug: {
            ownerId: createdById,
            slug: workspaceSlug,
          },
        },
        update: {
          status: "ACTIVE",
        },
        create: {
          ownerId: createdById,
          slug: workspaceSlug,
          name: workspaceName,
          kind: "GOVERNANCE",
          status: "ACTIVE",
          metadata: {
            source: "governance-workspace-backfill",
            templateVersionId: version.id,
          },
        },
      });

      if (!version.template.workspaceId) {
        await tx.relationTemplate.update({
          where: { id: version.template.id },
          data: { workspaceId: workspace.id },
        });
      }

      await tx.templateVersion.update({
        where: { id: version.id },
        data: {
          snapshot: {
            ...snapshot,
            metadata: {
              ...metadata,
              workspaceId: workspace.id,
              workspaceSlug: workspace.slug,
              workspaceName: workspace.name,
              workspacePersistence: "prisma-workspace-v1-backfilled",
            },
          } satisfies Prisma.InputJsonObject,
        },
      });
    });

    updated += 1;
  }

  console.log(`Backfill completed. Updated: ${updated}. Skipped: ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
