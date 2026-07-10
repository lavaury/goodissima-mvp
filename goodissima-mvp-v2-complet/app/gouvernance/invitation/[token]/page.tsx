import { notFound } from "next/navigation";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function GuestJourneyPage({ params }: { params: { token: string } }) {
  const invitation = await prisma.governedJourneyInvitation.findUnique({ where: { accessTokenHash: hashJourneyInvitationToken(params.token) }, include: { relationTemplate: { select: { name:true, description:true } } } });
  if (!invitation) notFound();
  const expired = invitation.accessTokenExpiresAt <= new Date();
  if (invitation.status === "REVOKED" || expired) return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-bold">Accès refusé</h1><p className="mt-3">Ce lien est expiré ou a été révoqué.</p></main>;
  await prisma.governedJourneyInvitation.update({ where: { id: invitation.id }, data: { status: "ACTIVE", acceptedAt: invitation.acceptedAt ?? new Date(), lastAccessedAt: new Date() } });
  return <main className="mx-auto max-w-2xl p-8"><p className="text-sm font-semibold text-[#247f88]">Parcours gouverné · accès invité limité</p><h1 className="mt-2 text-3xl font-bold">{invitation.relationTemplate.name}</h1><p className="mt-4">{invitation.relationTemplate.description}</p><section className="mt-6 rounded-lg border bg-slate-50 p-5"><h2 className="font-bold">Votre accès</h2><p className="mt-2">Invité : {invitation.displayName}</p><p>Rôle : {invitation.role}</p><p className="mt-3 text-sm">Cet accès donne uniquement accès à ce parcours. Aucun workspace, autre dossier ou média n’est ouvert.</p></section></main>;
}
