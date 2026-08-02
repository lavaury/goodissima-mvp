export const dynamic = "force-dynamic";
export const revalidate = 0;
import { handleDecisionExplanation } from "@/lib/governed-memory/http/handlers";
export async function GET(request: Request, { params }: { params: { relationCaseId: string; decisionId: string } }) { return handleDecisionExplanation(request, params); }
