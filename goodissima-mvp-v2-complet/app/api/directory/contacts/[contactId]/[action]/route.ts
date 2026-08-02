import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { directoryApiError, readDirectoryJson, representationContactJson } from "@/lib/directory/api";
import { archiveMyContact, restoreMyContact } from "@/lib/directory/representation-contact-service";
export async function POST(request: Request, { params }: { params: { contactId: string; action: string } }) { const owner = await getCurrentPrismaUser(); try { const body = await readDirectoryJson(request); const contact = params.action === "archive" ? await archiveMyContact(owner.id, params.contactId, body) : params.action === "restore" ? await restoreMyContact(owner.id, params.contactId, body) : null; if (!contact) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 }); return NextResponse.json({ contact: representationContactJson(contact) }); } catch (error) { return directoryApiError(error); } }
