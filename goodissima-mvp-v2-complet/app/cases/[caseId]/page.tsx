import { RelationCaseWorkspace } from "@/components/RelationCaseWorkspace";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({ params }: { params: { caseId: string } }) {
  noStore();

  const owner = await getCurrentPrismaUser();
  const item = await prisma.relationCase.findFirst({
    where: { id: params.caseId, ownerId: owner.id },
    include: {
      gLink: true,
      messages: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
      relationEvents: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) notFound();

  return <RelationCaseWorkspace item={item} senderEmail="demo@goodissima.app" senderType="OWNER" />;
}
