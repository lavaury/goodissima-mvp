export type GovernedMemoryTransitionActionState =
  | { status: "IDLE" }
  | { status: "SUCCESS"; transition: "ESTABLISH_FACT" | "DISPUTE_FACT" | "VALIDATE_DECISION" | "GRANT_JOURNEY_MEMORY_ROLE" | "REVOKE_JOURNEY_MEMORY_ROLE"; message: string }
  | { status: "ERROR"; code: "INVALID_INPUT" | "NOT_FOUND" | "FORBIDDEN" | "STATE_CONFLICT" | "TRANSITION_CONFLICT" | "ALREADY_APPLIED" | "GOVERNED_MEMORY_TRANSITION_FAILED"; message: string; fieldErrors?: Record<string, string> };

export const initialGovernedMemoryTransitionActionState: GovernedMemoryTransitionActionState = { status: "IDLE" };
