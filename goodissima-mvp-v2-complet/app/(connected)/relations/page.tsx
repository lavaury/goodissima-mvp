export const dynamic = "force-dynamic";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductLifecycle, ProductObjectDefinition } from "@/components/ProductObjectClarity";
import { RelationRequestsPanel } from "@/components/RelationRequestsPanel";

export default async function RelationsPage() {
  const owner = await getCurrentPrismaUser();
  const [relations, relationRequests] = await Promise.all([
    prisma.relationCase.findMany({ where: { ownerId: owner.id }, orderBy: { createdAt: "desc" }, include: { gLink: { select: { title: true, city: true } } } }),
    prisma.publicCaseCreationRequest.findMany({ where: { status: "PENDING", gLink: { ownerId: owner.id }, requestPayload: { not: Prisma.DbNull } }, orderBy: { createdAt: "desc" }, include: { gLink: { select: { title: true } } } }),
  ]);
  const pending = relations.filter((item) => ["NEW", "WAITING_CANDIDATE", "WAITING_OWNER", "REVIEWING"].includes(item.status)).length;
  const accepted = relations.filter((item) => ["VALIDATED", "CLOSED"].includes(item.status)).length;
  const requests = relationRequests.map((request) => { const data = request.requestPayload as Record<string, unknown>; return { id: request.id, title: request.gLink.title, candidateName: typeof data.candidateName === "string" ? data.candidateName : "" }; });
  return <main className="mx-auto max-w-6xl px-6 py-10">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#247f88]">Espaces gouvernés</p><h1 className="mt-2 text-3xl font-bold">Relations</h1><ProductObjectDefinition object="relation" /></div>
    <ProductLifecycle current="relation" /><RelationRequestsPanel requests={requests} />
    <p className="sr-only">Conversation & documents, demandes relationnelles, gouvernance et assistance IA.</p>
    <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">Workspace relationnel</h2><p className="mt-1 text-sm text-slate-500">Les demandes restent séparées des relations jusqu’à leur acceptation explicite.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-amber-50 p-4"><p className="text-sm text-amber-800">Relations en attente</p><p className="mt-2 text-2xl font-bold">{pending}</p></div><div className="rounded-2xl bg-emerald-50 p-4"><p className="text-sm text-emerald-800">Relations acceptées</p><p className="mt-2 text-2xl font-bold">{accepted}</p></div></div></section>
    <div className="mt-6">{relations.length ? <div className="space-y-3">{relations.map((relation) => <article key={relation.id} className="flex flex-col gap-3 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">{relation.gLink.title}</h2><p className="mt-1 text-sm text-slate-500">{relation.candidateName} · {relation.gLink.city ?? "Localisation non précisée"}</p><p className="mt-2 text-xs font-medium text-[#247f88]">Statut relationnel : {relation.status}</p></div><Link href={`/cases/${relation.id}`} className="rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white">Ouvrir la relation</Link></article>)}</div> : <div className="rounded-3xl border border-dashed bg-white p-10 text-center"><h2 className="font-semibold">Aucune relation ouverte</h2><p className="mt-2 text-sm text-slate-500">Une relation apparaîtra ici après acceptation d’une demande.</p></div>}</div>
  </main>;
}
