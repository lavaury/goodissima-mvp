export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { directoryApiError, representationContactJson } from "@/lib/directory/api";
import { listMyContacts } from "@/lib/directory/representation-contact-service";
export async function GET() { noStore(); const owner = await getCurrentPrismaUser(); try { return NextResponse.json({ contacts: (await listMyContacts(owner.id)).map(representationContactJson) }); } catch (error) { return directoryApiError(error); } }
