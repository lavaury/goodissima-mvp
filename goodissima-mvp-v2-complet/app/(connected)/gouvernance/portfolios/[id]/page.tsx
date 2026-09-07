import { notFound } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getPortfolioExplorer } from "@/lib/portfolio-explorer-repository";
import { getAvailableWorkspacesForPortfolio, portfolioKindLabels } from "@/lib/governance-portfolio-repository";
import { PortfolioExplorerView } from "@/components/PortfolioExplorerView";
import { PortfolioOrganize } from "@/components/PortfolioOrganize";

export const dynamic = "force-dynamic";
export default async function GovernancePortfolioDetailPage({ params }: { params: { id: string } }) {
  const owner = await getCurrentPrismaUser();
  const portfolio = await getPortfolioExplorer(owner.id, params.id);
  if (!portfolio) notFound();
  const available = portfolio.status === "ACTIVE" ? await getAvailableWorkspacesForPortfolio(owner.id) : [];
  return <PortfolioExplorerView portfolio={portfolio} kindLabel={portfolioKindLabels[portfolio.kind]} organize={<PortfolioOrganize portfolio={portfolio} available={available} />} />;
}
