import type { CommunicationSessionStatus, MeetingRsvpStatus } from "@prisma/client";

export type GuestMeetingState = "PREPARED" | "OPEN" | "EXPIRED" | "COMPLETED" | "CANCELLED";

export function projectGuestMeetingState(session: { status: CommunicationSessionStatus; accessOpened: boolean; expiresAt: Date | null }, now = new Date()): GuestMeetingState {
  if (session.status === "COMPLETED") return "COMPLETED";
  if (session.status === "CANCELLED") return "CANCELLED";
  if (session.expiresAt && session.expiresAt <= now) return "EXPIRED";
  if (session.status === "PREPARED_NOT_STARTED" || !session.accessOpened) return "PREPARED";
  return "OPEN";
}

export function guestMeetingStateLabel(state: GuestMeetingState) {
  return ({ PREPARED: "Réunion préparée", OPEN: "Réunion ouverte", EXPIRED: "Réunion expirée", COMPLETED: "Réunion terminée", CANCELLED: "Réunion annulée" } as const)[state];
}

export function guestMeetingRsvpLabel(status: MeetingRsvpStatus | null | undefined, state: GuestMeetingState) {
  const past = state === "EXPIRED" || state === "COMPLETED" || state === "CANCELLED";
  if (status === "ACCEPTED") return past ? "Vous aviez confirmé votre participation à cette réunion." : "Participation confirmée";
  if (status === "DECLINED") return past ? "Vous aviez décliné votre participation à cette réunion." : "Participation déclinée";
  return status === "PENDING" ? "Invitation en attente" : "Réponse historique non enregistrée";
}

export function guestMeetingAvailabilityMessage(state: GuestMeetingState, rsvpStatus: MeetingRsvpStatus | null | undefined) {
  if (state === "EXPIRED") return "Cette réunion n’est plus accessible.";
  if (state === "COMPLETED") return "Cette réunion est terminée et reste consultable à titre historique.";
  if (state === "CANCELLED") return "Cette réunion a été annulée par l’organisateur.";
  if (rsvpStatus === "DECLINED") return "Vous avez décliné cette réunion.";
  if (state === "PREPARED" && rsvpStatus === "ACCEPTED") return "La salle sera disponible lorsque l’organisateur ouvrira la réunion.";
  if (state === "PREPARED") return "L’accès média sera disponible après votre acceptation et l’ouverture de la réunion.";
  return "La salle est ouverte. Confirmez votre participation pour pouvoir la rejoindre.";
}
