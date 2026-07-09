import { RelationCaseWorkspace } from "@/components/RelationCaseWorkspace";
import { getCurrentPrismaUser } from "@/lib/auth";
import { isGoodissimaDebugMode } from "@/lib/debug";
import { getGovernanceWorkspaceOptions } from "@/lib/governance-workspace-repository";
import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({ params }: { params: { caseId: string } }) {
  noStore();

  const owner = await getCurrentPrismaUser();
  const debugMode = isGoodissimaDebugMode();
  const now = new Date();
  const [item, workspaceOptions] = await Promise.all([
    prisma.relationCase.findFirst({
    where: { id: params.caseId, ownerId: owner.id },
    include: {
      gLink: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          kind: true,
        },
      },
      candidateIdentity: {
        select: {
          id: true,
          status: true,
          credentials: {
            where: {
              status: "ACTIVE",
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
            orderBy: { issuedAt: "desc" },
            select: {
              id: true,
              issuedAt: true,
              credentialType: {
                select: {
                  code: true,
                  name: true,
                },
              },
              issuerTrustedOrganization: {
                select: {
                  organizationId: true,
                },
              },
            },
          },
        },
      },
      messages: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      communicationSessions: { orderBy: { createdAt: "desc" } },
      relationActions: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      formSubmissions: {
        orderBy: { createdAt: "desc" },
        include: {
          formTemplate: {
            include: {
              fields: { orderBy: [{ step: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
            },
          },
        },
      },
      auditLogs: { orderBy: { createdAt: "desc" } },
      relationEvents: { orderBy: { createdAt: "desc" } },
    },
    }),
    getGovernanceWorkspaceOptions(owner.id),
  ]);

  if (!item) notFound();

  const organizationName = owner.name && owner.name !== owner.email ? owner.name : "Organisation Goodissima";

  return (
    <RelationCaseWorkspace
      item={item}
      senderType="OWNER"
      organizationName={organizationName}
      debugMode={debugMode}
      workspaceOptions={workspaceOptions}
    />
  );
}
