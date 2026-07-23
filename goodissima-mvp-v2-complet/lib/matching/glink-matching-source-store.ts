import type { PrismaClient } from "@prisma/client";
import type {
  ExecutableGLinkMatchingSource,
  GLinkMatchingSourceStore,
} from "./matching-execution-service.ts";

const fieldSelection = {
  orderBy: [{ step: "asc" as const }, { position: "asc" as const }],
  select: {
    label: true,
    type: true,
    options: true,
    validationRules: true,
  },
};

export class PrismaGLinkMatchingSourceStore implements GLinkMatchingSourceStore {
  private readonly client: PrismaClient;

  constructor(client: PrismaClient) {
    this.client = client;
  }

  async findSourceForOwner(ownerId: string, gLinkId: string): Promise<ExecutableGLinkMatchingSource | null> {
    const link = await this.client.gLink.findFirst({
      where: { id: gLinkId, ownerId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        description: true,
        status: true,
        templateId: true,
        rules: true,
        template: {
          select: {
            formTemplates: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { fields: fieldSelection },
            },
          },
        },
      },
    });
    if (!link) return null;
    return {
      sourceType: "GLINK",
      sourceId: link.id,
      ownerId: link.ownerId,
      title: link.title,
      description: link.description,
      fields: link.template?.formTemplates[0]?.fields ?? [],
      status: link.status,
      rules: link.rules,
      templateId: link.templateId,
    };
  }

  async listActiveCandidatesForOwner(ownerId: string, excludedGLinkId: string, limit: number) {
    const links = await this.client.gLink.findMany({
      where: { ownerId, status: "ACTIVE", id: { not: excludedGLinkId } },
      orderBy: { id: "asc" },
      take: limit,
      select: {
        id: true,
        ownerId: true,
        title: true,
        description: true,
        template: {
          select: {
            formTemplates: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { fields: fieldSelection },
            },
          },
        },
      },
    });
    return links.map((link) => ({
      sourceType: "GLINK" as const,
      sourceId: link.id,
      ownerId: link.ownerId,
      title: link.title,
      description: link.description,
      fields: link.template?.formTemplates[0]?.fields ?? [],
    }));
  }
}
