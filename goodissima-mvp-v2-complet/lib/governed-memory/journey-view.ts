import type { JourneyMemoryProjection } from "./contracts";

export function projectJourneyMemoryView(memory: JourneyMemoryProjection) {
  return {
    facts: memory.facts.filter((fact) => fact.state !== "proposed"),
    decisions: memory.decisions.filter((decision) => decision.state === "validated"),
    sources: memory.capabilities.canViewSources ? memory.sources : [],
    pending: memory.pending,
  };
}

export function factStateLabel(state: JourneyMemoryProjection["facts"][number]["state"]) {
  return state === "contested" ? "Contesté" : state === "superseded" ? "Remplacé" : "Confirmé";
}
