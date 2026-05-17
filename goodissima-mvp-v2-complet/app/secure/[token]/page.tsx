import { RelationCaseWorkspace } from "@/components/RelationCaseWorkspace";
import { activeCandidateAccessWhere } from "@/lib/candidate-access";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SecureCasePage({ params }: { params: { token: string } }) {
  const item = await prisma.relationCase.findFirst({
    where: activeCandidateAccessWhere(params.token),
    include: {
      gLink: true,
      messages: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) notFound();

  return (
    <RelationCaseWorkspace
      item={item}
      senderEmail={item.candidateEmail}
      senderType="CANDIDATE"
      candidateAccessToken={item.candidateAccessToken}
    />
  );
}
