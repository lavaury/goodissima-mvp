import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { resolveCanonicalOwnerRelationCaseId } from "@/lib/canonical-relation-case";
import { GovernedJourneyDetailView } from "@/components/governed-journey/GovernedJourneyPresenters";
import { GovernedJourneyReadError, governedJourneyReadService } from "@/lib/governed-journey/read/service";

export const dynamic = "force-dynamic";
export default async function GovernedJourneyPage({ params }: { params: { caseId: string; journeyId: string } }) {
  noStore();
  const owner = await getCurrentPrismaUser();
  const canonicalCaseId = await resolveCanonicalOwnerRelationCaseId(params.caseId, owner.id);
  if (!canonicalCaseId) notFound();
  if (canonicalCaseId !== params.caseId) redirect(`/cases/${encodeURIComponent(canonicalCaseId)}/journeys/${encodeURIComponent(params.journeyId)}`);
  let journey;
  try { journey = await governedJourneyReadService.detail({ relationCaseId: canonicalCaseId, journeyId: params.journeyId, requesterUserId: owner.id }); }
  catch (error) { if (error instanceof GovernedJourneyReadError) notFound(); throw error; }
  return <main className="mx-auto max-w-4xl bg-[#fbf7f1] px-4 py-8 text-[#2f3437] sm:px-6"><Link href={`/cases/${encodeURIComponent(canonicalCaseId)}/journeys`} className="text-sm font-semibold text-[#247f88] underline">Retour aux parcours</Link><p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[#247f88]">Parcours gouverné</p><h1 className="mt-2 text-3xl font-bold">{journey.title}</h1><GovernedJourneyDetailView journey={journey} /></main>;
}
