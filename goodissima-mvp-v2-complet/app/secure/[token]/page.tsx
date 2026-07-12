import { RelationCaseWorkspace } from "@/components/RelationCaseWorkspace";
import { resolveCandidateSecureAccess } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SecureCasePage({ params }: { params: { token: string } }) {
  noStore();

  const access = await resolveCandidateSecureAccess(params.token);
  if (!access) notFound();

  const item = await prisma.relationCase.findUnique({
    where: { id: access.id },
    include: {
      gLink: true,
      messages: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      communicationSessions: { orderBy: { createdAt: "desc" } },
      relationActions: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      auditLogs: { orderBy: { createdAt: "desc" } },
      relationEvents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) notFound();

  return (
    <RelationCaseWorkspace
      item={item}
      senderType="CANDIDATE"
      candidateAccessToken={item.candidateAccessToken}
    />
  );
}
