import Link from "next/link";
import { receivedJourneyInvitationLabel } from "@/lib/governed-journey-inbox";

type Invitation = Awaited<ReturnType<typeof import("@/lib/governed-journey-inbox").getReceivedJourneyInvitations>>[number];

export function ReceivedJourneyInvitations({ invitations }: { invitations: Invitation[] }) {
  const pending = invitations.filter((item) => item.state === "PENDING");
  return <section className="mt-8 rounded-xl border bg-white p-5" aria-labelledby="received-journey-invitations-title">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="received-journey-invitations-title" className="text-xl font-bold">Invitations reçues</h2><p className="text-sm font-semibold text-slate-600">{pending.length} invitation{pending.length > 1 ? "s" : ""} à examiner</p></div>
    {invitations.length === 0 ? <p className="mt-3 text-sm text-slate-600">Aucune invitation Journey reçue.</p> : <ul className="mt-4 space-y-3">{invitations.map((item) => <li key={item.id} className="min-w-0 rounded-lg border bg-slate-50 p-4"><h3 className="break-words font-bold">{item.journeyName}</h3><p className="mt-1 text-sm text-slate-600">Invité par : {item.organizerName || "L’organisateur du parcours"}</p>{item.objective ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">Objectif : {item.objective}</p> : null}{item.participationContext ? <p className="mt-1 text-sm text-slate-600">Contexte de participation : {item.participationContext}</p> : null}<p className="mt-2 text-sm font-semibold text-[#176b73]">{receivedJourneyInvitationLabel(item.state)}</p><Link href={item.href} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-[#247f88] px-4 py-2 text-sm font-bold text-[#176b73] outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2">Voir l’invitation</Link></li>)}</ul>}
  </section>;
}
