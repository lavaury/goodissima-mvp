import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { directoryApiError, readDirectoryJson, representationJson } from "@/lib/directory/api";
import { createRepresentation, listRepresentations } from "@/lib/directory/representation-service";

export async function GET() {
  const owner = await getCurrentPrismaUser();
  try {
    const representations = await listRepresentations(owner.id);
    return NextResponse.json({ representations: representations.map(representationJson) });
  } catch (error) {
    return directoryApiError(error);
  }
}

export async function POST(request: Request) {
  const owner = await getCurrentPrismaUser();
  try {
    const representation = await createRepresentation(owner.id, await readDirectoryJson(request));
    return NextResponse.json({ representation: representationJson(representation) }, { status: 201 });
  } catch (error) {
    return directoryApiError(error);
  }
}
