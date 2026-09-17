import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGovernedInvitationRoleLabel } from "@/lib/governed-invitation-role-label";
import { projectJourneyParticipationState } from "@/lib/governed-journey-consent";
import { receivedJourneyInvitationLabel } from "@/lib/governed-journey-inbox";
import { acceptReceivedJourneyInvitation, declineReceivedJourneyInvitation } from "@/lib/governed-journey-inbox-actions";

export const dynamic = "force-dynamic";

export default async function ReceivedJourneyInvitationPage({ params, searchParams }: { params: { id: string }; searchParams?: { decision?: string } }) {
  const user = await getCurrentPrismaUser();
  const invitation = await prisma.governedJourneyInvitation.findFirst({ where: { id: params.id, inviteeUserId: user.id }, include: { consent: true, relationTemplate: { select: { name: true, description: true } } } });
  if (!invitation) notFound();
  const inviter = await prisma.user.findUnique({ where: { id: invitation.ownerId }, select: { name: true } });
  const state = invitation.accessTokenExpiresAt <= new Date() && projectJourneyParticipationState(invitation) !== "REVOKED" ? "EXPIRED" : projectJourneyParticipationState(invitation);
  const context = getGovernedInvitationRoleLabel(invitation.role, invitation.metadata);
  return <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6"><p className="text-sm font-semibold text-[#247f88]">Invitation au parcours</p><h1 className="mt-2 text-3xl font-bold">Vous êtes invité(e) à participer à « {invitation.relationTemplate.name} »</h1>{invitation.relationTemplate.description ? <p className="mt-4"><strong>Objectif :</strong> {invitation.relationTemplate.description}</p> : null}<section className="mt-6 rounded-lg border bg-slate-50 p-5"><h2 className="font-bold">Votre participation</h2><p className="mt-2"><strong>Invité par :</strong> {inviter?.name || "L’organisateur du parcours"}</p>{context ? <p className="mt-2"><strong>Contexte de participation :</strong> {context}</p> : <p className="mt-2">Participation prévue</p>}<p className="mt-3 font-semibold text-[#176b73]">{receivedJourneyInvitationLabel(state)}</p></section>{state === "PENDING" ? <div className="mt-6 flex flex-col gap-3 sm:flex-row"><form action={acceptReceivedJourneyInvitation}><input type="hidden" name="invitationId" value={invitation.id} /><button className="min-h-11 rounded-lg bg-[#247f88] px-5 py-3 font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Accepter de participer</button></form><form action={declineReceivedJourneyInvitation}><input type="hidden" name="invitationId" value={invitation.id} /><button className="min-h-11 rounded-lg border px-5 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2">Refuser</button></form></div> : null}{searchParams?.decision === "unavailable" ? <p role="alert" className="mt-4 text-red-700">Cette décision ne peut pas être enregistrée.</p> : null}<Link href="/gouvernance" className="mt-8 inline-flex min-h-11 items-center font-semibold underline">Retour à Mes espaces</Link></main>;
}
