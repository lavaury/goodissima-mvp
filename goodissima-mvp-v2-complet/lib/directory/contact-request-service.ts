import {
  contactRequestExpiry, deferredDate, parseCancelContactRequestInput, parseContactRequestDecisionInput,
  parseCreateContactRequestInput, type ContactRequestSummary,
} from "@/lib/directory/contact-request-contracts";
import { contactRequestRepository, type ContactRequestRepository } from "@/lib/directory/contact-request-repository";

export class ContactRequestServiceError extends Error {
  constructor(readonly code: "NOT_FOUND" | "CONFLICT" | "EXPIRED" | "SELF_REQUEST" | "POLICY_CLOSED" | "POLICY_MESSAGE_ONLY", message: string) { super(message); }
}
const terminal = ["ACCEPTED", "REFUSED", "CANCELLED", "EXPIRED"];
function expired(request: { expiresAt: Date | null }, now: Date) { return Boolean(request.expiresAt && request.expiresAt <= now); }

export async function createContactRequest(ownerId: string, value: unknown, repository: ContactRequestRepository = contactRequestRepository, now = new Date()) {
  const input = parseCreateContactRequestInput(value); const result = await repository.createRequest(ownerId, input, contactRequestExpiry(now, input.expiresAt));
  if (result.outcome === "NOT_FOUND") throw new ContactRequestServiceError("NOT_FOUND", "Representation not found.");
  if (result.outcome === "SELF") throw new ContactRequestServiceError("SELF_REQUEST", "A representation cannot request its own owner.");
  if (result.outcome === "DUPLICATE") throw new ContactRequestServiceError("CONFLICT", "An identical pending request already exists.");
  if (result.outcome === "POLICY_CLOSED") throw new ContactRequestServiceError("POLICY_CLOSED", "Target is closed to new requests.");
  if (result.outcome === "POLICY_MESSAGE_ONLY") throw new ContactRequestServiceError("POLICY_MESSAGE_ONLY", "Target accepts message-only requests.");
  return result.request;
}
export const listIncomingContactRequests = (ownerId: string, repository: ContactRequestRepository = contactRequestRepository) => repository.findIncomingForOwner(ownerId, 50);
export const listOutgoingContactRequests = (ownerId: string, repository: ContactRequestRepository = contactRequestRepository) => repository.findOutgoingForOwner(ownerId, 50);

async function decide(ownerId: string, id: string, value: unknown, action: "ACCEPTED" | "REFUSED" | "DEFERRED" | "PENDING", repository: ContactRequestRepository, now: Date): Promise<ContactRequestSummary> {
  const input = parseContactRequestDecisionInput(value, action === "DEFERRED"); const current = await repository.findForDecision(ownerId, id);
  if (!current) throw new ContactRequestServiceError("NOT_FOUND", "Contact request not found.");
  if (expired(current, now)) { await repository.markExpiredIfNeeded(id, now); throw new ContactRequestServiceError("EXPIRED", "Contact request has expired."); }
  if (current.status === action) return (await repository.findIncomingForOwner(ownerId)).find((item) => item.id === id)!;
  if (terminal.includes(current.status)) throw new ContactRequestServiceError("CONFLICT", "Contact request is already final.");
  if (action === "PENDING" && current.status !== "DEFERRED") throw new ContactRequestServiceError("CONFLICT", "Only a deferred request can be resumed.");
  if (action !== "PENDING" && current.status === "DEFERRED" && current.deferredUntil && current.deferredUntil > now) throw new ContactRequestServiceError("CONFLICT", "The deferral period has not ended.");
  const deferredUntil = action === "DEFERRED" ? deferredDate(now, input.deferredUntil) : null;
  const ok = await repository.decideConditionally(ownerId, id, new Date(input.expectedUpdatedAt), action === "PENDING" ? ["DEFERRED"] : ["PENDING", "DEFERRED"],
    { status: action, deferredUntil, decidedAt: action === "PENDING" || action === "DEFERRED" ? null : now, decidedByUserId: action === "PENDING" ? null : ownerId },
    action === "PENDING" ? "RESUMED" : action);
  if (!ok) throw new ContactRequestServiceError("CONFLICT", "Contact request changed concurrently.");
  return (await repository.findIncomingForOwner(ownerId)).find((item) => item.id === id)!;
}
export const acceptContactRequest = (ownerId: string, id: string, value: unknown, repository = contactRequestRepository, now = new Date()) => decide(ownerId, id, value, "ACCEPTED", repository, now);
export const refuseContactRequest = (ownerId: string, id: string, value: unknown, repository = contactRequestRepository, now = new Date()) => decide(ownerId, id, value, "REFUSED", repository, now);
export const deferContactRequest = (ownerId: string, id: string, value: unknown, repository = contactRequestRepository, now = new Date()) => decide(ownerId, id, value, "DEFERRED", repository, now);
export const resumeContactRequest = (ownerId: string, id: string, value: unknown, repository = contactRequestRepository, now = new Date()) => decide(ownerId, id, value, "PENDING", repository, now);
export async function cancelContactRequest(ownerId: string, id: string, value: unknown, repository = contactRequestRepository, now = new Date()) {
  const input = parseCancelContactRequestInput(value); const current = await repository.findForCancellation(ownerId, id);
  if (!current) throw new ContactRequestServiceError("NOT_FOUND", "Contact request not found.");
  if (expired(current, now)) { await repository.markExpiredIfNeeded(id, now); throw new ContactRequestServiceError("EXPIRED", "Contact request has expired."); }
  if (current.status === "CANCELLED") return (await repository.findOutgoingForOwner(ownerId)).find((item) => item.id === id)!;
  if (!["PENDING", "DEFERRED"].includes(current.status)) throw new ContactRequestServiceError("CONFLICT", "Contact request cannot be cancelled.");
  if (!await repository.cancelConditionally(ownerId, id, new Date(input.expectedUpdatedAt), now)) throw new ContactRequestServiceError("CONFLICT", "Contact request changed concurrently.");
  return (await repository.findOutgoingForOwner(ownerId)).find((item) => item.id === id)!;
}
