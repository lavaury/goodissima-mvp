import { notFound } from "next/navigation";
import { getCurrentPrismaUser } from "@/lib/auth";
import { getWorkspacePortfolioContext, parseWorkspacePortfolioId } from "@/lib/workspace-portfolio-context";
import { WorkspaceCreationForm } from "@/components/WorkspaceCreationForm";
export const dynamic = "force-dynamic";
export default async function NewGovernanceWorkspacePage({ searchParams = {} }: { searchParams?: { portfolioId?: string | string[] } }) {
  const owner = await getCurrentPrismaUser();
  let portfolioId: string | null;
  try { portfolioId = parseWorkspacePortfolioId(searchParams.portfolioId); } catch { notFound(); }
  const portfolio = portfolioId ? await getWorkspacePortfolioContext(owner.id, portfolioId) : null;
  if (portfolioId && !portfolio) notFound();
  return <WorkspaceCreationForm portfolio={portfolio} />;
}
