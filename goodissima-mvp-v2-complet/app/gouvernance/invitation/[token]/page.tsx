import Link from "next/link";
import { notFound } from "next/navigation";
import { GovernedInvitationStatusRefresh } from "@/components/GovernedInvitationStatusRefresh";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { normalizeInvitationEmail } from "@/lib/access-invitations";
import { getCurrentUser } from "@/lib/auth";
import { acceptJourneyInvitation, declineJourneyInvitation } from "@/lib/governed-journey-consent-actions";
import { hasCurrentJourneyAccess, projectJourneyConsent } from "@/lib/governed-journey-consent";
import { getGovernedInvitationRoleLabel } from "@/lib/governed-invitation-role-label";
import { hashJourneyInvitationToken } from "@/lib/governed-journey-invitations";
import { prisma } from "@/lib/prisma";
import { acceptMeetingRsvp, declineMeetingRsvp } from "@/lib/governed-meeting-rsvp-actions";
import { hasCurrentMeetingMediaAccess, meetingRsvpLabel } from "@/lib/governed-meeting-rsvp";

export const dynamic = "force-dynamic";

export default async function GuestJourneyPage({ params, searchParams }: { params: { token: string }; searchParams?: { decision?: string } }) {
  const invitation = await prisma.governedJourneyInvitation.findUnique({
    where: { accessTokenHash: hashJourneyInvitationToken(params.token) },
    include: { consent: true, relationTemplate: { select: { name: true, description: true } } },
  });
  if (!invitation) notFound();
  const inviter = await prisma.user.findUnique({ where: { id: invitation.ownerId }, select: { name: true } });
  if (invitation.status === "REVOKED" || invitation.revokedAt || invitation.accessTokenExpiresAt <= new Date()) {
    return <main className="mx-auto max-w-2xl p-8"><h1 className="text-2xl font-bold">Accès refusé</h1><p className="mt-3">Ce lien est expiré ou a été révoqué.</p><p className="mt-3"><strong>Invité par :</strong> {inviter?.name || "L’organisateur du parcours"}</p></main>;
  }

  const authUser = await getCurrentUser();
  const currentUser = authUser?.email ? await prisma.user.findUnique({ where: { email: normalizeInvitationEmail(authUser.email) }, select: { id: true } }) : null;
  const consentFlow = projectJourneyConsent(invitation) === "NEW_CONSENT_FLOW";
  const participationContext = getGovernedInvitationRoleLabel(invitation.role, invitation.metadata);
  await prisma.governedJourneyInvitation.update({ where: { id: invitation.id }, data: consentFlow ? { lastAccessedAt: new Date() } : { acceptedAt: invitation.acceptedAt ?? new Date(), lastAccessedAt: new Date() } });

  if (consentFlow && invitation.consent?.status === "DECLINED") {
    return <main className="mx-auto max-w-2xl p-8"><p className="text-sm font-semibold text-[#247f88]">Invitation au parcours</p><h1 className="mt-2 text-2xl font-bold">Vous avez refusé cette invitation.</h1><p className="mt-3"><strong>Invité par :</strong> {inviter?.name || "L’organisateur du parcours"}</p><p className="mt-3 text-slate-600">Aucun accès au parcours ou à ses réunions n’a été ouvert.</p></main>;
  }

  if (consentFlow && currentUser && invitation.inviteeUserId && invitation.inviteeUserId !== currentUser.id) {
    return <main className="mx-auto max-w-2xl p-8"><p className="text-sm font-semibold text-[#247f88]">Invitation au parcours</p><h1 className="mt-2 text-2xl font-bold">Invitation indisponible</h1><p className="mt-3">Cette invitation est liée à un autre compte.</p></main>;
  }

  if (consentFlow && invitation.consent?.status === "ACCEPTED" && invitation.inviteeUserId && !currentUser) {
    return <main className="mx-auto max-w-2xl p-8"><p className="text-sm font-semibold text-[#247f88]">Invitation au parcours</p><h1 className="mt-2 text-2xl font-bold">Identité requise</h1><Link className="mt-6 inline-block rounded bg-[#247f88] px-5 py-3 font-semibold text-white" href={`/login?next=${encodeURIComponent(`/gouvernance/invitation/${params.token}`)}`}>Se connecter pour accéder au parcours</Link></main>;
  }

  if (consentFlow && !hasCurrentJourneyAccess(invitation)) {
    const canDecide = invitation.inviteeUserId ? invitation.inviteeUserId === currentUser?.id : true;
    const needsLogin = Boolean(invitation.inviteeUserId && !currentUser);
    return <main className="mx-auto max-w-2xl p-8">
      <p className="text-sm font-semibold text-[#247f88]">Invitation au parcours</p>
      <h1 className="mt-2 text-3xl font-bold">Vous êtes invité(e) à participer à « {invitation.relationTemplate.name} »</h1>
      <p className="mt-4"><strong>Objectif :</strong> {invitation.relationTemplate.description || "Participer à ce parcours gouverné."}</p>
      <section className="mt-6 rounded-lg border bg-slate-50 p-5"><h2 className="font-bold">Votre participation</h2><p className="mt-2"><strong>Invité par :</strong> {inviter?.name || "L’organisateur du parcours"}</p>{participationContext ? <p className="mt-2"><strong>Contexte de participation :</strong> {participationContext}</p> : <p className="mt-2">Participation prévue</p>}<p className="mt-3 text-sm">Vous pourrez consulter les éléments partagés dans ce parcours et contribuer selon le rôle proposé. Les réunions nécessitent également une autorisation propre.</p>{!invitation.inviteeUserId ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Cette invitation personnelle prouve la possession du lien, mais ne vérifie pas votre identité. Le nom affiché a été déclaré par l’organisateur.</p> : null}</section>
      {canDecide ? <div className="mt-6 flex flex-wrap gap-3"><form action={acceptJourneyInvitation}><input type="hidden" name="invitationToken" value={params.token} /><button className="rounded bg-[#247f88] px-5 py-3 font-semibold text-white">Accepter de participer</button></form><form action={declineJourneyInvitation}><input type="hidden" name="invitationToken" value={params.token} /><button className="rounded border px-5 py-3 font-semibold">Refuser</button></form></div> : needsLogin ? <Link className="mt-6 inline-block rounded bg-[#247f88] px-5 py-3 font-semibold text-white" href={`/login?next=${encodeURIComponent(`/gouvernance/invitation/${params.token}`)}`}>Se connecter pour répondre</Link> : <p className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm">{invitation.inviteeUserId ? "Cette invitation est liée à un autre compte." : "La réponse en ligne n’est pas encore disponible pour une invitation externe sans identité vérifiée."}</p>}
      {searchParams?.decision === "unavailable" ? <p className="mt-4 text-sm text-red-700">Cette décision ne peut pas être enregistrée.</p> : null}
    </main>;
  }

  const meetings = await prisma.governedMeetingParticipant.findMany({ where: { governedJourneyInvitationId: invitation.id, status: "AUTHORIZED", communicationSession: { relationTemplateId: invitation.relationTemplateId, relationCaseId: null } }, include: { communicationSession: true, rsvp: true }, orderBy: { authorizedAt: "desc" } });
  return <main className="mx-auto max-w-2xl p-8"><GovernedInvitationStatusRefresh /><p className="text-sm font-semibold text-[#247f88]">Invitation au parcours</p><h1 className="mt-2 text-3xl font-bold">Vous participez à « {invitation.relationTemplate.name} »</h1><p className="mt-4"><strong>Objectif :</strong> {invitation.relationTemplate.description}</p><section className="mt-6 rounded-lg border bg-slate-50 p-5"><h2 className="font-bold">Votre participation</h2><p className="mt-2"><strong>Invitation envoyée par :</strong> {inviter?.name || "L’organisateur du parcours"}</p><p className="mt-2"><strong>Personne invitée :</strong> {invitation.displayName}</p>{participationContext ? <p><strong>Contexte de participation :</strong> {participationContext}</p> : null}<p className="mt-3 text-sm">Votre accès est limité à ce parcours. Cette invitation ne vous donne pas automatiquement accès à toutes ses réunions, à un autre dossier ou à l’espace de l’organisateur.</p>{!invitation.inviteeUserId ? <p className="mt-3 text-sm font-semibold text-amber-900">L’invitation personnelle a été acceptée. Elle ne constitue pas une identité vérifiée.</p> : null}</section>
    {meetings.length > 0 ? <section className="mt-6"><h2 className="text-xl font-bold">Réunions</h2>{meetings.map((participant) => { const session = participant.communicationSession; const live = hasCurrentMeetingMediaAccess(participant) && session.provider === "LIVEKIT_PENDING"; const ended = session.status === "COMPLETED" || session.status === "CANCELLED"; return <article key={session.id} className="mt-3 rounded-lg border bg-white p-4"><h3 className="font-bold">{session.title}</h3><p className="mt-1 text-sm text-slate-600"><strong>Objectif :</strong> {session.purpose || "Participer à cette réunion du Parcours."}</p><p className="mt-1 text-sm text-slate-600"><strong>Date :</strong> {session.scheduledAt ? session.scheduledAt.toLocaleString("fr-FR") : "Date à définir"}</p><p className="mt-1 text-sm text-slate-600"><strong>Parcours :</strong> {invitation.relationTemplate.name}</p><p className="mt-2 text-sm font-semibold">{meetingRsvpLabel(participant.rsvp)}</p>{participant.rsvp?.status === "PENDING" && !ended ? <div className="mt-4"><p className="mb-3 font-semibold">Vous êtes invité(e) à cette réunion.</p><div className="flex gap-3"><form action={acceptMeetingRsvp}><input type="hidden" name="invitationToken" value={params.token} /><input type="hidden" name="meetingParticipantId" value={participant.id} /><button className="rounded bg-[#247f88] px-4 py-2 font-semibold text-white">Participer</button></form><form action={declineMeetingRsvp}><input type="hidden" name="invitationToken" value={params.token} /><input type="hidden" name="meetingParticipantId" value={participant.id} /><button className="rounded border px-4 py-2 font-semibold">Décliner</button></form></div></div> : null}{live ? <><p className="my-3 text-sm text-slate-600">Audio, vidéo et partage d’écran sont disponibles après votre connexion et restent sous votre contrôle.</p><RelationLiveKitMediaRoom contextKind="governedJourney" governedJourneyId={invitation.relationTemplateId} actorKind="guest" available guestAccessToken={params.token} preferredSessionId={session.id} joinLabel="Rejoindre la réunion" /></> : <p className="mt-3 rounded bg-slate-50 p-3 text-sm text-slate-600">{ended ? "Cette réunion est terminée et n’est plus accessible." : participant.rsvp?.status === "DECLINED" ? "Vous avez décliné cette réunion." : participant.rsvp?.status === "ACCEPTED" ? "La réunion n’a pas encore été ouverte par l’organisateur." : "L’accès média sera disponible après votre acceptation et l’ouverture de la réunion."}</p>}</article>; })}</section> : null}
  </main>;
}
