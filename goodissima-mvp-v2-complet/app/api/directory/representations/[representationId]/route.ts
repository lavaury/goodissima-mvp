import { NextResponse } from "next/server";
import { getCurrentPrismaUser } from "@/lib/auth";
import { directoryApiError, readDirectoryJson, representationJson } from "@/lib/directory/api";
import {
  archiveRepresentation,
  getRepresentation,
  hideRepresentation,
  restoreRepresentation,
  setRelationshipPolicy,
  updateRepresentation,
} from "@/lib/directory/representation-service";

export async function GET(_: Request, { params }: { params: { representationId: string } }) {
  const owner = await getCurrentPrismaUser();
  try {
    const representation = await getRepresentation(owner.id, params.representationId);
    return NextResponse.json({ representation: representationJson(representation) });
  } catch (error) {
    return directoryApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { representationId: string } }) {
  const owner = await getCurrentPrismaUser();
  try {
    const body = await readDirectoryJson(request);
    const action = body && typeof body === "object" && !Array.isArray(body) ? body.action : undefined;
    const expectedUpdatedAt = body && typeof body === "object" && !Array.isArray(body) && typeof body.expectedUpdatedAt === "string"
      ? body.expectedUpdatedAt
      : undefined;
    const representation = action === "hide"
      ? await hideRepresentation(owner.id, params.representationId, expectedUpdatedAt)
      : action === "restore"
        ? await restoreRepresentation(owner.id, params.representationId, expectedUpdatedAt)
        : action === "archive"
          ? await archiveRepresentation(owner.id, params.representationId, expectedUpdatedAt)
          : body && typeof body === "object" && !Array.isArray(body) && "relationshipPolicy" in body
            ? await setRelationshipPolicy(owner.id, params.representationId, body)
          : await updateRepresentation(owner.id, params.representationId, body);
    return NextResponse.json({ representation: representationJson(representation) });
  } catch (error) {
    return directoryApiError(error);
  }
}
