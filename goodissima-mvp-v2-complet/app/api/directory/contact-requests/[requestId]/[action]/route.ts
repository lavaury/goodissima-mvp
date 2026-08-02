import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { contactRequestJson, directoryApiError, readDirectoryJson } from "@/lib/directory/api";
import { acceptContactRequest, cancelContactRequest, deferContactRequest, refuseContactRequest, resumeContactRequest } from "@/lib/directory/contact-request-service";
const actions = { accept: acceptContactRequest, refuse: refuseContactRequest, defer: deferContactRequest, resume: resumeContactRequest, cancel: cancelContactRequest } as const;
export async function POST(request: Request, { params }: { params: { requestId: string; action: string } }) { const owner = await getCurrentPrismaUser(); try { const action = actions[params.action as keyof typeof actions]; if (!action) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); const result = await action(owner.id, params.requestId, await readDirectoryJson(request)); return NextResponse.json({ request: contactRequestJson(result) }); } catch (error) { return directoryApiError(error); } }
