import { parseArchiveContactInput, parseCreateContactFromRequestInput, parseRestoreContactInput } from "@/lib/directory/representation-contact-contracts";
import { representationContactRepository, type RepresentationContactRepository } from "@/lib/directory/representation-contact-repository";

export class RepresentationContactServiceError extends Error {
  constructor(readonly code: "NOT_FOUND" | "NOT_ACCEPTED" | "CONFLICT" | "PERSISTENCE_FAILED", message: string) { super(message); }
}

export async function createContactFromAcceptedRequest(ownerId: string, requestId: string, value: unknown, repository: RepresentationContactRepository = representationContactRepository, now = new Date()) {
  const input = parseCreateContactFromRequestInput(value);
  const result = await repository.createPairFromAcceptedRequest(ownerId, requestId, new Date(input.expectedUpdatedAt), now);
  if (result.outcome === "NOT_FOUND") throw new RepresentationContactServiceError("NOT_FOUND", "Accepted request not found.");
  if (result.outcome === "NOT_ACCEPTED") throw new RepresentationContactServiceError("NOT_ACCEPTED", "Only an accepted request can create contacts.");
  if (result.outcome === "CONFLICT") throw new RepresentationContactServiceError("CONFLICT", "Request changed concurrently.");
  if (result.contacts.length !== 2 || !result.actorContactId) throw new RepresentationContactServiceError("PERSISTENCE_FAILED", "Contact pair confirmation is incomplete.");
  const contact = result.contacts.find(({ id }) => id === result.actorContactId);
  if (!contact) throw new RepresentationContactServiceError("PERSISTENCE_FAILED", "Local contact confirmation is missing.");
  return { contact, contacts: result.contacts, created: result.outcome === "CREATED" };
}

export const listMyContacts = (ownerId: string, repository: RepresentationContactRepository = representationContactRepository) => repository.findContactsForOwner(ownerId, 50);

export async function archiveMyContact(ownerId: string, contactId: string, value: unknown, repository: RepresentationContactRepository = representationContactRepository, now = new Date()) {
  const input = parseArchiveContactInput(value); const current = await repository.findContactForOwner(ownerId, contactId);
  if (!current) throw new RepresentationContactServiceError("NOT_FOUND", "Contact not found.");
  if (current.status === "ARCHIVED") return current;
  if (current.status !== "ACTIVE") throw new RepresentationContactServiceError("CONFLICT", "Contact cannot be archived.");
  if (!await repository.archiveContactForOwner(ownerId, contactId, new Date(input.expectedUpdatedAt), now)) throw new RepresentationContactServiceError("CONFLICT", "Contact changed concurrently.");
  const updated = await repository.findContactForOwner(ownerId, contactId);
  if (!updated) throw new RepresentationContactServiceError("PERSISTENCE_FAILED", "Archived contact confirmation is missing.");
  return updated;
}

export async function restoreMyContact(ownerId: string, contactId: string, value: unknown, repository: RepresentationContactRepository = representationContactRepository) {
  const input = parseRestoreContactInput(value); const current = await repository.findContactForOwner(ownerId, contactId);
  if (!current) throw new RepresentationContactServiceError("NOT_FOUND", "Contact not found.");
  if (current.status === "ACTIVE") return current;
  if (current.status !== "ARCHIVED") throw new RepresentationContactServiceError("CONFLICT", "Contact cannot be restored.");
  if (!await repository.restoreContactForOwner(ownerId, contactId, new Date(input.expectedUpdatedAt))) throw new RepresentationContactServiceError("CONFLICT", "Contact changed concurrently.");
  const updated = await repository.findContactForOwner(ownerId, contactId);
  if (!updated) throw new RepresentationContactServiceError("PERSISTENCE_FAILED", "Restored contact confirmation is missing.");
  return updated;
}
