import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { directoryApiError, readDirectoryJson, representationContactJson } from "@/lib/directory/api";
import { createContactFromAcceptedRequest } from "@/lib/directory/representation-contact-service";
export async function POST(request: Request, { params }: { params: { requestId: string } }) { const owner = await getCurrentPrismaUser(); try { const result = await createContactFromAcceptedRequest(owner.id, params.requestId, await readDirectoryJson(request)); return NextResponse.json({ contact: representationContactJson(result.contact), created: result.created }, { status: result.created ? 201 : 200 }); } catch (error) { return directoryApiError(error); } }
