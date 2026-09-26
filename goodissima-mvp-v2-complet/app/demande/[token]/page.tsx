import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifyPublicRelationRequestFollowUpToken } from "@/lib/public-relation-request-followup";
import { PublicRelationRequestStatusRefresh } from "@/components/PublicRelationRequestStatusRefresh";

export const dynamic = "force-dynamic";

export default async function PublicRelationRequestFollowUpPage({ params }: { params: { token: string } }) {
  noStore();
  const claims = verifyPublicRelationRequestFollowUpToken(params.token); if (!claims) notFound();
  const request = await prisma.publicCaseCreationRequest.findFirst({ where: { id: claims.r, gLinkId: claims.g, expiresAt: { gt: new Date() }, status: { in: ["PENDING", "ACCEPTED", "DECLINED"] } }, select: { status: true, createdAt: true, expiresAt: true, declineReason: true, relationCaseId: true, gLink: { select: { title: true } }, relationCase: { select: { id: true, candidateAccessToken: true } } } });
  if (!request || claims.e > Math.floor(request.expiresAt.getTime() / 1000)) notFound();
  const accepted = request.status === "ACCEPTED" && request.relationCaseId && request.relationCase?.id === request.relationCaseId;
  return <main className="mx-auto max-w-xl px-6 py-12"><PublicRelationRequestStatusRefresh pending={request.status === "PENDING"} /><p className="text-sm font-semibold uppercase tracking-wide text-[#247f88]">Votre demande</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{request.gLink.title}</h1><p className="mt-3 text-sm text-slate-500">Envoyée le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(request.createdAt)}</p><section className="mt-8 rounded-3xl border bg-white p-6 shadow-sm" aria-live="polite">
    {request.status === "PENDING" ? <><h2 className="text-xl font-bold">Votre demande est en attente de décision.</h2><p className="mt-3 text-slate-600">Cette page se met à jour automatiquement. Vous pouvez également la conserver pour revenir suivre la demande.</p></> : null}
    {accepted ? <><h2 className="text-xl font-bold text-emerald-900">Votre demande a été acceptée.</h2><p className="mt-3 text-slate-600">La relation et sa conversation sécurisée sont maintenant ouvertes.</p><Link href={`/secure/${encodeURIComponent(request.relationCase!.candidateAccessToken)}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#247f88] px-5 font-semibold text-white">Accéder à la conversation sécurisée</Link></> : null}
    {request.status === "DECLINED" ? <><h2 className="text-xl font-bold text-slate-950">Votre demande n’a pas été acceptée.</h2><p className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-950"><strong>Motif communiqué :</strong> {request.declineReason}</p></> : null}
  </section></main>;
}
