"use server";

import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentPrismaUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DocumentReceptionMetadata = {
  receptionId: string;
  documentName: string;
  reference: string | null;
  note: string | null;
  status: "RECEIVED_DECLARED";
  receivedAt: string;
  receivedById: string;
  fileStored: false;
  automaticValidation: false;
};

function textFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function existingReceptions(value: unknown): DocumentReceptionMetadata[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const row = asRecord(item);
      const receptionId = typeof row.receptionId === "string" && row.receptionId.trim() ? row.receptionId.trim() : "";
      const documentName = typeof row.documentName === "string" && row.documentName.trim() ? row.documentName.trim() : "";
      const receivedAt = typeof row.receivedAt === "string" && row.receivedAt.trim() ? row.receivedAt.trim() : "";
      const receivedById = typeof row.receivedById === "string" && row.receivedById.trim() ? row.receivedById.trim() : "";
      if (!receptionId || !documentName || !receivedAt || !receivedById) return null;

      return {
        receptionId,
        documentName,
        reference: typeof row.reference === "string" && row.reference.trim() ? row.reference.trim() : null,
        note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
        status: "RECEIVED_DECLARED" as const,
        receivedAt,
        receivedById,
        fileStored: false as const,
        automaticValidation: false as const,
      };
    })
    .filter((item): item is DocumentReceptionMetadata => item !== null);
}

function documentKey(name: string) {
  return name.trim().toLowerCase();
}

export async function declareDocumentReceptionAction(formData: FormData) {
  const owner = await getCurrentPrismaUser();
  const formTemplateId = textFromForm(formData, "formTemplateId");
  const documentName = textFromForm(formData, "documentName");
  const optionalReference = textFromForm(formData, "optionalReference");
  const optionalNote = textFromForm(formData, "optionalNote");

  if (!formTemplateId || !documentName) {
    throw new Error("Informations document incompletes.");
  }

  const formTemplate = await prisma.formTemplate.findUnique({
    where: { id: formTemplateId },
    include: {
      relationTemplate: {
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const latestVersion = formTemplate?.relationTemplate?.versions[0];
  if (!formTemplate || !latestVersion) {
    throw new Error("Parcours introuvable.");
  }

  const snapshot = asRecord(latestVersion.snapshot);
  const metadata = asRecord(snapshot.metadata);
  const currentReceptions = existingReceptions(metadata.documentReceptions);
  const key = documentKey(documentName);
  const previous = currentReceptions.find((reception) => documentKey(reception.documentName) === key);

  const declaredReception: DocumentReceptionMetadata = {
    receptionId: previous?.receptionId ?? `declared-${randomUUID()}`,
    documentName,
    reference: optionalReference || null,
    note: optionalNote || null,
    status: "RECEIVED_DECLARED",
    receivedAt: new Date().toISOString(),
    receivedById: owner.id,
    fileStored: false,
    automaticValidation: false,
  };

  const documentReceptions = [
    ...currentReceptions.filter((reception) => documentKey(reception.documentName) !== key),
    declaredReception,
  ];

  await prisma.templateVersion.update({
    where: { id: latestVersion.id },
    data: {
      snapshot: {
        ...snapshot,
        metadata: {
          ...metadata,
          documentReceptions,
        },
      } as Prisma.InputJsonObject,
    },
  });

  const path = `/gouvernance/parcours/${formTemplate.id}/pilotage`;
  revalidatePath(path);
  redirect(path);
}
