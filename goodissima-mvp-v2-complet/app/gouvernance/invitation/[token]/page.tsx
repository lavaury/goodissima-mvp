import { GovernedInvitationStatusRefresh } from "@/components/GovernedInvitationStatusRefresh";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { getGovernedInvitationRoleLabel } from "@/lib/governed-invitation-role-label";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GuestJourneyPage({ params }: { params: { token: string } }) {
  const invitation = await prisma.governedJourneyInvitation.findUnique({
    where: { accessTokenHash: hashJourneyInvitationToken(params.token) },
    include: { relationTemplate: { select: { name: true, description: true } } },
  });
  if (!invitation) notFound();
  if (invitation.status !== "ACTIVE" || invitation.revokedAt || invitation.accessTokenExpiresAt <= new Date()) {
    return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-bold">Acces refuse</h1><p className="mt-3">Ce lien est expire ou a ete revoque.</p></main>;
  }

  await prisma.governedJourneyInvitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: invitation.acceptedAt ?? new Date(), lastAccessedAt: new Date() },
  });
  const meetings = await prisma.governedMeetingParticipant.findMany({
    where: {
      governedJourneyInvitationId: invitation.id,
      status: "AUTHORIZED",
      communicationSession: { relationTemplateId: invitation.relationTemplateId, relationCaseId: null },
    },
    include: { communicationSession: true },
    orderBy: { authorizedAt: "desc" },
  });

  return <main className="mx-auto max-w-2xl p-8">
    <GovernedInvitationStatusRefresh />
    <p className="text-sm font-semibold text-[#247f88]">Parcours gouverne - acces invite limite</p>
    <h1 className="mt-2 text-3xl font-bold">{invitation.relationTemplate.name}</h1>
    <p className="mt-4">{invitation.relationTemplate.description}</p>
    <section className="mt-6 rounded-lg border bg-slate-50 p-5"><h2 className="font-bold">Votre acces</h2><p className="mt-2">Invite : {invitation.displayName}</p><p>Role : {getGovernedInvitationRoleLabel(invitation.role, invitation.metadata)}</p><p className="mt-3 text-sm">Votre acces est limite a ce parcours. Aucun Workspace ni autre dossier n'est accessible.</p></section>
    <section className="mt-6"><h2 className="text-xl font-bold">Reunions disponibles</h2>
      {meetings.length === 0 ? <p className="mt-3 rounded-lg border bg-slate-50 p-4">Aucune reunion n'est disponible pour votre acces pour le moment.</p> : meetings.map(({ communicationSession: session }) => {
        const live = session.status === "REQUESTED" && session.provider === "LIVEKIT_PENDING" && session.accessOpened && (!session.expiresAt || session.expiresAt > new Date());
        const ended = session.status === "COMPLETED" || session.status === "CANCELLED";
        return <article key={session.id} className="mt-3 rounded-lg border bg-white p-4">
          <h3 className="font-bold">{session.title}</h3>
          {session.purpose ? <p className="mt-1 text-sm text-slate-600">{session.purpose}</p> : null}
          <p className="mt-2 text-sm font-semibold">Etat : {ended ? "Terminee" : live ? "En direct" : "Preparee"}</p>
          {live ? <><p className="my-3 text-sm text-slate-600">Le micro, la camera et le partage d'ecran ne demarrent qu'apres votre accord.</p><RelationLiveKitMediaRoom contextKind="governedJourney" governedJourneyId={invitation.relationTemplateId} actorKind="guest" available guestAccessToken={params.token} preferredSessionId={session.id} joinLabel="Rejoindre la salle securisee" /></> : <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">{ended ? "Cette reunion est terminee et n'est plus rejoignable." : "La reunion n'a pas encore ete lancee par l'organisateur."}</p>}
        </article>;
      })}
    </section>
  </main>;
}
