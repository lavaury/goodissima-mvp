import { NextResponse } from "next/server";
import { DirectoryValidationError } from "@/lib/directory/contracts";
import { DirectoryServiceError } from "@/lib/directory/representation-service";

export function directoryApiError(error: unknown) {
  if (error instanceof DirectoryValidationError) {
    return NextResponse.json({ error: "INVALID_REPRESENTATION_PAYLOAD", issues: error.issues }, { status: 400 });
  }
  if (error instanceof DirectoryServiceError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" || error.code === "INVALID_TRANSITION" ? 409 : 400;
    return NextResponse.json({ error: error.code }, { status });
  }
  console.error("[directory] representation operation failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: "DIRECTORY_OPERATION_FAILED" }, { status: 500 });
}

export async function readDirectoryJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new DirectoryValidationError(["payload must be valid JSON"]);
  }
}

export function representationJson(representation: {
  id: string;
  type: string;
  displayName: string;
  title: string | null;
  organizationName: string | null;
  description: string | null;
  territory: string | null;
  status: string;
  relationshipPolicy: string;
  visibility: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}) {
  return {
    ...representation,
    createdAt: representation.createdAt.toISOString(),
    updatedAt: representation.updatedAt.toISOString(),
    archivedAt: representation.archivedAt?.toISOString() ?? null,
    publishedAt: representation.publishedAt?.toISOString() ?? null,
  };
}
