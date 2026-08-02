export const dynamic = "force-dynamic";
export const revalidate = 0;
import { handleMemoryState } from "@/lib/governed-memory/http/handlers";
export async function GET(request: Request, { params }: { params: { relationCaseId: string } }) { return handleMemoryState(request, params); }
