export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { contactRequestJson, directoryApiError, readDirectoryJson } from "@/lib/directory/api";
import { createContactRequest, listIncomingContactRequests, listOutgoingContactRequests } from "@/lib/directory/contact-request-service";
export async function GET(request: Request) { noStore(); const owner = await getCurrentPrismaUser(); try { const direction = new URL(request.url).searchParams.get("direction"); if (direction !== "incoming" && direction !== "outgoing") return NextResponse.json({ error: "INVALID_DIRECTION" }, { status: 400 }); const rows = direction === "incoming" ? await listIncomingContactRequests(owner.id) : await listOutgoingContactRequests(owner.id); return NextResponse.json({ requests: rows.map(contactRequestJson) }); } catch (error) { return directoryApiError(error); } }
export async function POST(request: Request) { const owner = await getCurrentPrismaUser(); try { return NextResponse.json({ request: contactRequestJson(await createContactRequest(owner.id, await readDirectoryJson(request))) }, { status: 201 }); } catch (error) { return directoryApiError(error); } }
