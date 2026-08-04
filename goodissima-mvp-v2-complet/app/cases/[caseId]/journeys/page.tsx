import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { resolveCanonicalOwnerRelationCaseId } from "@/lib/canonical-relation-case";
import { GovernedJourneyCards } from "@/components/governed-journey/GovernedJourneyPresenters";
import { GovernedJourneyReadError, governedJourneyReadService } from "@/lib/governed-journey/read/service";

export const dynamic = "force-dynamic";
export default async function GovernedJourneysPage({ params, searchParams }: { params: { caseId: string }; searchParams: { cursor?: string } }) {
  noStore();
  const owner = await getCurrentPrismaUser();
  const canonicalCaseId = await resolveCanonicalOwnerRelationCaseId(params.caseId, owner.id);
  if (!canonicalCaseId) notFound();
  if (canonicalCaseId !== params.caseId) redirect(`/cases/${encodeURIComponent(canonicalCaseId)}/journeys`);
  let page;
  try { page = await governedJourneyReadService.list({ relationCaseId: canonicalCaseId, requesterUserId: owner.id, cursor: searchParams.cursor }); }
  catch (error) { if (error instanceof GovernedJourneyReadError) notFound(); throw error; }
  return <main className="mx-auto max-w-4xl bg-[#fbf7f1] px-4 py-8 text-[#2f3437] sm:px-6"><Link href={`/cases/${encodeURIComponent(canonicalCaseId)}`} className="text-sm font-semibold text-[#247f88] underline">Retour au dossier</Link><p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#247f88]">Gouvernance</p><h1 className="mt-2 text-3xl font-bold">Parcours gouvernés</h1><p className="mt-2 text-sm text-[#766f68]">Consultation des parcours réels rattachés à ce dossier.</p><GovernedJourneyCards caseId={canonicalCaseId} journeys={page.items} />{page.nextCursor ? <Link href={`/cases/${encodeURIComponent(canonicalCaseId)}/journeys?cursor=${encodeURIComponent(page.nextCursor)}`} className="mt-5 inline-block rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Voir les suivants</Link> : null}</main>;
}
