export const dynamic = "force-dynamic";
export const revalidate = 0;
import { handleMemoryObjectTrace } from "@/lib/governed-memory/http/handlers";
export async function GET(request: Request, { params }: { params: { relationCaseId: string; objectType: string; objectId: string } }) { return handleMemoryObjectTrace(request, params); }
