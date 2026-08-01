import type { RepresentationStatus } from "@prisma/client";
import {
  canTransitionRepresentation,
  parseCreateRepresentationInput,
  parseUpdateRepresentationInput,
  parseSetRelationshipPolicyInput,
  parseSetRepresentationVisibilityInput,
  type RepresentationView,
  representationTransitionPatch,
  representationVisibilityPatch,
} from "@/lib/directory/contracts";
import {
  representationRepository,
  type RepresentationRepository,
} from "@/lib/directory/representation-repository";

export class DirectoryServiceError extends Error {
  constructor(
    readonly code: "IDENTITY_REQUIRED" | "NOT_FOUND" | "CONFLICT" | "INVALID_TRANSITION",
    message: string,
  ) {
    super(message);
  }
}

export async function createRepresentation(
  ownerId: string,
  value: unknown,
  repository: RepresentationRepository = representationRepository,
) {
  const created = await repository.createForOwner(ownerId, parseCreateRepresentationInput(value));
  if (!created) throw new DirectoryServiceError("IDENTITY_REQUIRED", "A Goodissima identity is required.");
  return created;
}

export function listRepresentations(ownerId: string, repository: RepresentationRepository = representationRepository) {
  return repository.listForOwner(ownerId);
}

export async function getRepresentation(
  ownerId: string,
  id: string,
  repository: RepresentationRepository = representationRepository,
) {
  const found = await repository.findForOwner(ownerId, id);
  if (!found) throw new DirectoryServiceError("NOT_FOUND", "Representation not found.");
  return found;
}

export async function updateRepresentation(
  ownerId: string,
  id: string,
  value: unknown,
  repository: RepresentationRepository = representationRepository,
) {
  const result = await repository.updateConditionallyForOwner(ownerId, id, parseUpdateRepresentationInput(value));
  return unwrapUpdate(result);
}

export async function setRelationshipPolicy(
  ownerId: string,
  id: string,
  value: unknown,
  repository: RepresentationRepository = representationRepository,
) {
  const input = parseSetRelationshipPolicyInput(value);
  const current = await repository.findForOwner(ownerId, id);
  if (!current) throw new DirectoryServiceError("NOT_FOUND", "Representation not found.");
  if (current.relationshipPolicy === input.relationshipPolicy) return current;
  return unwrapUpdate(await repository.updateConditionallyForOwner(ownerId, id, input));
}

export async function setRepresentationVisibility(
  ownerId: string,
  id: string,
  value: unknown,
  repository: RepresentationRepository = representationRepository,
) {
  const input = parseSetRepresentationVisibilityInput(value);
  const current = await repository.findForOwner(ownerId, id);
  if (!current) throw new DirectoryServiceError("NOT_FOUND", "Representation not found.");
  const patch = representationVisibilityPatch(current, input.visibility);
  if (!patch) throw new DirectoryServiceError("INVALID_TRANSITION", "Representation must be active to be discoverable.");
  if (Object.keys(patch).length === 0) return current;
  return unwrapUpdate(await repository.updateConditionallyForOwner(ownerId, id, { ...patch, expectedUpdatedAt: input.expectedUpdatedAt }));
}

export function publishRepresentation(ownerId: string, id: string, expectedUpdatedAt?: string, repository: RepresentationRepository = representationRepository) {
  return setRepresentationVisibility(ownerId, id, { visibility: "DISCOVERABLE", expectedUpdatedAt }, repository);
}

export function unpublishRepresentation(ownerId: string, id: string, expectedUpdatedAt?: string, repository: RepresentationRepository = representationRepository) {
  return setRepresentationVisibility(ownerId, id, { visibility: "PRIVATE", expectedUpdatedAt }, repository);
}

async function transitionRepresentation(
  ownerId: string,
  id: string,
  target: RepresentationStatus,
  expectedUpdatedAt: string | undefined,
  repository: RepresentationRepository,
): Promise<RepresentationView> {
  const current = await repository.findForOwner(ownerId, id);
  if (!current) throw new DirectoryServiceError("NOT_FOUND", "Representation not found.");
  if (!canTransitionRepresentation(current.status, target)) {
    throw new DirectoryServiceError("INVALID_TRANSITION", "Representation transition is not allowed.");
  }
  const patch = representationTransitionPatch(current, target);
  if (!patch) throw new DirectoryServiceError("INVALID_TRANSITION", "Representation transition is not allowed.");
  if (current.status === target) return current;
  const result = await repository.updateConditionallyForOwner(ownerId, id, {
    ...patch,
    expectedUpdatedAt,
  });
  return unwrapUpdate(result);
}

function unwrapUpdate(result: Awaited<ReturnType<RepresentationRepository["updateConditionallyForOwner"]>>) {
  if (result.outcome === "NOT_FOUND") throw new DirectoryServiceError("NOT_FOUND", "Representation not found.");
  if (result.outcome === "CONFLICT") throw new DirectoryServiceError("CONFLICT", "Representation changed concurrently.");
  return result.representation;
}

export function hideRepresentation(ownerId: string, id: string, expectedUpdatedAt?: string, repository: RepresentationRepository = representationRepository) {
  return transitionRepresentation(ownerId, id, "HIDDEN", expectedUpdatedAt, repository);
}

export function restoreRepresentation(ownerId: string, id: string, expectedUpdatedAt?: string, repository: RepresentationRepository = representationRepository) {
  return transitionRepresentation(ownerId, id, "ACTIVE", expectedUpdatedAt, repository);
}

export function archiveRepresentation(ownerId: string, id: string, expectedUpdatedAt?: string, repository: RepresentationRepository = representationRepository) {
  return transitionRepresentation(ownerId, id, "ARCHIVED", expectedUpdatedAt, repository);
}
