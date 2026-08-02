export const dynamic = "force-dynamic";
export const revalidate = 0;
import { handleAccessReconstruction } from "@/lib/governed-memory/http/handlers";
export async function GET(request: Request, { params }: { params: { relationCaseId: string } }) { return handleAccessReconstruction(request, params); }
