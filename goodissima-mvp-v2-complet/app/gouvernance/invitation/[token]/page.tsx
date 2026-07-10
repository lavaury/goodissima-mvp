import { notFound } from "next/navigation";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GuestJourneyPage({ params }: { params: { token: string } }) {
  const invitation = await prisma.governedJourneyInvitation.findUnique({
    where: { accessTokenHash: hashJourneyInvitationToken(params.token) },
    include: { relationTemplate: { select: { name: true, description: true } } },
  });
  if (!invitation) notFound();
  const expired = invitation.accessTokenExpiresAt <= new Date();
  if (invitation.status !== "ACTIVE" || invitation.revokedAt || expired) {
    return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-bold">Accès refusé</h1><p className="mt-3">Ce lien est expiré ou a été révoqué.</p></main>;
  }
  await prisma.governedJourneyInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: invitation.acceptedAt ?? new Date(), lastAccessedAt: new Date() } });

  return <main className="mx-auto max-w-2xl p-8">
    <p className="text-sm font-semibold text-[#247f88]">Parcours gouverné · accès invité limité</p>
    <h1 className="mt-2 text-3xl font-bold">{invitation.relationTemplate.name}</h1>
    <p className="mt-4">{invitation.relationTemplate.description}</p>
    <section className="mt-6 rounded-lg border bg-slate-50 p-5">
      <h2 className="font-bold">Votre accès</h2><p className="mt-2">Invité : {invitation.displayName}</p><p>Rôle : {invitation.role}</p>
      <p className="mt-3 text-sm">Votre accès est limité à ce parcours. Aucun workspace ni autre dossier n’est accessible.</p>
    </section>
    <div className="mt-6">
      <p className="mb-3 text-sm text-slate-600">Vous pouvez rejoindre la salle sécurisée du parcours si l’organisateur l’a ouverte. Le micro, la caméra et le partage d’écran ne démarrent qu’après votre accord.</p>
      <RelationLiveKitMediaRoom contextKind="governedJourney" governedJourneyId={invitation.relationTemplateId} actorKind="guest" available guestAccessToken={params.token} />
    </div>
  </main>;
}
