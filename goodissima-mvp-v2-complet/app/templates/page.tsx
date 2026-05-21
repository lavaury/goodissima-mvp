export const dynamic = "force-dynamic";

import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function TemplatesPage() {
  noStore();
  await getCurrentPrismaUser();

  const templates = await prisma.formTemplate.findMany({
    include: {
      _count: { select: { fields: true } },
      relationTemplate: {
        include: {
          _count: { select: { links: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-slate-500">Playground minimal des formulaires dynamiques.</p>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border bg-white">
        {templates.length === 0 ? (
          <p className="p-8 text-slate-500">Aucun template pour le moment.</p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="grid gap-3 border-b p-5 lg:grid-cols-[1.3fr_1fr_1.6fr_0.6fr_0.7fr_1fr_auto] lg:items-center"
            >
              <p className="font-semibold">{template.name}</p>
              <p className="font-mono text-xs text-slate-500">{template.key}</p>
              <p className="text-sm text-slate-600">{template.description ?? "Sans description"}</p>
              <p className="text-sm text-slate-500">{template._count.fields} fields</p>
              <p className="text-sm text-slate-500">{template.relationTemplate?._count.links ?? 0} liens</p>
              <p className="text-sm text-slate-500">{formatDate(template.createdAt)}</p>
              <Link
                href={`/templates/${template.id}`}
                className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white"
              >
                Tester ce template
              </Link>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
