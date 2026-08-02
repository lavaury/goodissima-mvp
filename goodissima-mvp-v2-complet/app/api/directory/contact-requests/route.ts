export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { contactRequestJson, directoryApiError, readDirectoryJson } from "@/lib/directory/api";
import { createContactRequest, listIncomingContactRequests, listOutgoingContactRequests } from "@/lib/directory/contact-request-service";

function databaseTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return { host: url.hostname || "unknown", database: url.pathname.replace(/^\//, "") || "unknown", schema: url.searchParams.get("schema") ?? "public" };
  } catch { return { host: "unknown", database: "unknown", schema: "public" }; }
}

export async function GET(request: Request) {
  noStore(); const owner = await getCurrentPrismaUser();
  try {
    const direction = new URL(request.url).searchParams.get("direction");
    if (direction !== "incoming" && direction !== "outgoing") return NextResponse.json({ error: "INVALID_DIRECTION" }, { status: 400 });
    const rows = direction === "incoming" ? await listIncomingContactRequests(owner.id) : await listOutgoingContactRequests(owner.id);
    return NextResponse.json({ requests: rows.map(contactRequestJson) });
  } catch (error) { return directoryApiError(error); }
}

export async function POST(request: Request) {
  const owner = await getCurrentPrismaUser();
  try {
    const created = await createContactRequest(owner.id, await readDirectoryJson(request));
    const persisted = contactRequestJson(created);
    if (!persisted?.id || persisted.status !== "PENDING" || !persisted.requesterRepresentation?.id || !persisted.targetRepresentation?.id || !Array.isArray(persisted.requestedChannels) || persisted.requestedChannels.length === 0 || !persisted.createdAt) {
      throw new Error("CONTACT_REQUEST_RESPONSE_INCOMPLETE");
    }
    console.info("[directory.contact-request.create] persisted", { ...databaseTarget(), requestId: persisted.id });
    return NextResponse.json({ request: persisted }, { status: 201 });
  } catch (error) {
    console.error("[directory.contact-request.create] failed", { ...databaseTarget(), code: error instanceof Error ? error.name : "UNKNOWN_ERROR" });
    return directoryApiError(error);
  }
}
