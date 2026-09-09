"use server";

import { revalidatePath } from "next/cache";
import * as commands from "@/lib/directory/directory-enrollment-commands";
import { DirectoryEnrollmentError, type AddDeclaredDirectoryAttributeInput, type UpdateDeclaredDirectoryAttributeInput } from "@/lib/directory/directory-enrollment-service";

export type DirectoryUiActionResult = { ok: true } | { ok: false; error: string };
const messages: Record<string, string> = {
  DIRECTORY_PERSON_IDENTITY_REQUIRED: "Une identité personnelle Goodissima est nécessaire pour créer une inscription.",
  DIRECTORY_PROFILE_ALREADY_EXISTS: "Une inscription existe déjà pour votre identité.",
  DIRECTORY_PROFILE_NOT_FOUND: "Cette inscription n’est plus accessible.",
  DIRECTORY_PERSON_AUTHORITY_REQUIRED: "Vous n’avez pas l’autorité nécessaire pour cette inscription.",
  DIRECTORY_OWNER_REQUIRED: "Seul le responsable de l’inscription peut effectuer cette action.",
  DIRECTORY_INVALID_PUBLIC_NAME: "Le nom public doit contenir entre 2 et 120 caractères et ne pas être un email.",
  DIRECTORY_INVALID_ATTRIBUTE: "Les informations de l’attribut sont invalides.",
  DIRECTORY_ATTRIBUTE_NOT_FOUND: "Cet attribut n’est plus accessible.",
  DIRECTORY_ATTRIBUTE_NOT_DECLARED: "Un attribut vérifié ne peut pas être modifié manuellement.",
  DIRECTORY_INVALID_TRANSITION: "Cette action n’est pas disponible dans l’état actuel.",
  DIRECTORY_PUBLISHED_ATTRIBUTE_REQUIRED: "Publiez au moins un attribut avant de publier l’inscription.",
};
async function execute(operation: () => Promise<unknown>): Promise<DirectoryUiActionResult> {
  try { await operation(); revalidatePath("/annuaire"); return { ok: true }; }
  catch (error) { if (error instanceof DirectoryEnrollmentError) return { ok: false, error: messages[error.code] ?? "Action impossible." }; throw error; }
}
export async function createDirectoryDraftAction(publicName: string) { return execute(() => commands.createMyDirectoryDraft({ publicName })); }
export async function updateDirectoryNameAction(publicId: string, publicName: string) { return execute(() => commands.updateMyDirectoryPublicName(publicId, publicName)); }
export async function addDirectoryAttributeAction(publicId: string, input: AddDeclaredDirectoryAttributeInput) { return execute(() => commands.addMyDeclaredDirectoryAttribute(publicId, input)); }
export async function updateDirectoryAttributeAction(publicId: string, attributeId: string, input: UpdateDeclaredDirectoryAttributeInput) { return execute(() => commands.updateMyDeclaredDirectoryAttribute(publicId, attributeId, input)); }
export async function publishDirectoryAttributeAction(publicId: string, attributeId: string) { return execute(() => commands.publishMyDirectoryAttribute(publicId, attributeId)); }
export async function withdrawDirectoryAttributeAction(publicId: string, attributeId: string) { return execute(() => commands.withdrawMyDirectoryAttribute(publicId, attributeId)); }
export async function publishDirectoryProfileAction(publicId: string) { return execute(() => commands.publishMyDirectoryProfile(publicId)); }
export async function disableDirectoryProfileAction(publicId: string) { return execute(() => commands.disableMyDirectoryProfile(publicId)); }
export async function republishDirectoryProfileAction(publicId: string) { return execute(() => commands.republishMyDirectoryProfile(publicId)); }
