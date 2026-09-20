import Link from "next/link";
import { notFound } from "next/navigation";
import { RelationLiveKitMediaRoom } from "@/components/RelationLiveKitMediaRoom";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GovernedJourneyMeetingRoomPage({
  params,
}: {
  params: { id: string; meetingId: string };
}) {
  const owner = await getCurrentPrismaUser();
  const meeting = await prisma.communicationSession.findFirst({
    where: {
      id: params.meetingId,
      ownerId: owner.id,
      relationCaseId: null,
      relationTemplate: { formTemplates: { some: { id: params.id } } },
    },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!meeting) notFound();
  const available =
    !["COMPLETED", "CANCELLED"].includes(meeting.status) &&
    (!meeting.expiresAt || meeting.expiresAt > new Date());

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link
        href={`/gouvernance/parcours/${params.id}/pilotage#meeting-${meeting.id}`}
        className="inline-flex min-h-11 items-center font-semibold text-[#247f88] underline underline-offset-4"
      >
        ← Retour au cockpit
      </Link>
      <p className="mt-3 text-sm text-slate-600">
        {meeting.scheduledAt
          ? meeting.scheduledAt.toLocaleString("fr-FR")
          : "Date à définir"}
      </p>
      <div className="mt-4">
        <RelationLiveKitMediaRoom
          contextKind="governedJourney"
          governedJourneyId={params.id}
          actorKind="owner"
          available={available}
          preferredSessionId={meeting.id}
          joinLabel="Entrer dans la réunion"
          returnHref={`/gouvernance/parcours/${params.id}/pilotage#meeting-${meeting.id}`}
        />
      </div>
    </div>
  );
}
