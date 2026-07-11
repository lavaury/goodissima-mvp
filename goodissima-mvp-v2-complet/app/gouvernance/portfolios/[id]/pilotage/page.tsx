import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformNavigation } from "@/components/PlatformNavigation";
import { GovernancePilotageAssistant } from "@/components/GovernancePilotageAssistant";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getGovernancePortfolioDetail } from "@/lib/governance-portfolio-repository";
import { getGovernancePilotage } from "@/lib/governance-pilotage-repository";
export const dynamic = "force-dynamic";
export default async function PortfolioPilotagePage({ params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser(); const portfolio = await getGovernancePortfolioDetail({ ownerId: owner.id, portfolioId: params.id }); if (!portfolio) notFound(); const data = await getGovernancePilotage(owner.id, portfolio.id);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><PlatformNavigation active="governance" organizationName={owner.name || "Organisation Goodissima"} /><div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-[#247f88]">Pilotage du Portfolio</p><h1 className="text-3xl font-bold">{portfolio.name}</h1></div><Link href={`/gouvernance/portfolios/${portfolio.id}`} className="text-sm font-bold underline">Retour au Portfolio</Link></div><GovernancePilotageAssistant portfolios={[{ id: portfolio.id, title: portfolio.name }]} initialPortfolioId={portfolio.id} /><p className="mt-6 text-sm font-bold">{data.signals.length ? `${data.signals.length} signal(s) lié(s) à ce Portfolio` : "Aucune intervention détectée pour ce Portfolio."}</p><div className="mt-3 grid gap-3 lg:grid-cols-2">{data.signals.map((signal) => <article key={signal.id} className="rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase text-[#247f88]">{signal.title}</p><h2 className="mt-1 font-bold">{signal.subject}</h2><p className="mt-2 text-sm text-slate-600">{signal.reason}</p><Link href={signal.href} className="mt-3 inline-block rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">{signal.actionLabel}</Link></article>)}</div></main>;
}
