export const dynamic = "force-dynamic";

import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { DEFAULT_RELATION_TEMPLATE_KEY } from "@/lib/relation-templates";
import { prisma } from "@/lib/prisma";
import { NewLinkForm } from "./NewLinkForm";

export default async function NewLinkPage() {
  noStore();
  await getCurrentPrismaUser();

  const templates = await prisma.relationTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
    },
  });
  const defaultTemplate = templates.find((template) => template.key === DEFAULT_RELATION_TEMPLATE_KEY);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-3xl font-bold">Creer un lien securise</h1>
      <NewLinkForm templates={templates} defaultTemplateId={defaultTemplate?.id ?? templates[0]?.id ?? null} />
    </main>
  );
}
