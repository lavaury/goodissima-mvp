export type CurrentStateMemoryCounts = {
  decisionsInForce: number;
  draftDecisions: number;
  disputedDecisions: number;
  establishedFacts: number;
  disputedFacts: number;
  proposedFacts: number;
  activeSources: number | null;
};

export type CurrentStateMeeting = {
  id: string;
  title: string;
  status: string;
  accessOpened: boolean;
  scheduledAt: Date | null;
  expiresAt: Date | null;
};

export type GovernedJourneyCurrentStateInput = {
  memory: CurrentStateMemoryCounts | null;
  participantCount: number;
  activeRoleCount: number;
  vacantRoleCount: number;
  expectedDocumentCount: number;
  receivedDocumentCount: number;
  pendingReviewCount: number;
  unscheduledMeetingCount: number;
  meetingWithoutParticipantCount: number;
  meetings: CurrentStateMeeting[];
  now: Date;
};

export type GovernedJourneyCurrentState = {
  decisions: { count: number; href: string } | null;
  facts: { establishedCount: number; disputedCount: number; href: string } | null;
  sources: { activeCount: number; href: string } | null;
  peopleAndRoles: { participantCount: number; activeRoleCount: number; vacantRoleCount: number; href: string } | null;
  clarifications: Array<{ kind: string; count: number; label: string }>;
  nextMeeting: { id: string; title: string; scheduledAt: Date; href: string } | null;
};

export type CurrentDecisionRecord = {
  status: "DRAFT" | "VALIDATED" | "SUPERSEDED" | "CANCELLED";
  effectiveFrom: Date | null;
  effectiveUntil: Date | null;
};

export type CurrentFactRecord = {
  status: "PROPOSED" | "ESTABLISHED" | "DISPUTED" | "SUPERSEDED";
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  supersededByFactId?: string | null;
};

export function decisionIsInForce(decision: CurrentDecisionRecord, now: Date) {
  return decision.status === "VALIDATED"
    && (!decision.effectiveFrom || decision.effectiveFrom <= now)
    && (!decision.effectiveUntil || decision.effectiveUntil > now);
}

export function factIsCurrent(fact: CurrentFactRecord, now: Date) {
  return (fact.status === "ESTABLISHED" || fact.status === "DISPUTED")
    && !fact.supersededByFactId
    && fact.effectiveFrom <= now
    && (!fact.effectiveUntil || fact.effectiveUntil > now);
}

function clarification(kind: string, count: number, singular: string, pluralForm: string) {
  return count > 0 ? [{ kind, count, label: count === 1 ? singular : pluralForm }] : [];
}

export function projectGovernedJourneyCurrentState(input: GovernedJourneyCurrentStateInput): GovernedJourneyCurrentState {
  const nextMeeting = input.meetings
    .filter((meeting) => meeting.status !== "COMPLETED" && meeting.status !== "CANCELLED")
    .filter((meeting) => !meeting.expiresAt || meeting.expiresAt > input.now)
    .filter((meeting): meeting is CurrentStateMeeting & { scheduledAt: Date } => Boolean(meeting.scheduledAt && meeting.scheduledAt > input.now))
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())[0] ?? null;

  const missingDocuments = Math.max(0, input.expectedDocumentCount - input.receivedDocumentCount);
  const memory = input.memory;

  return {
    decisions: memory && memory.decisionsInForce > 0 ? { count: memory.decisionsInForce, href: "#journey-memory" } : null,
    facts: memory && (memory.establishedFacts > 0 || memory.disputedFacts > 0)
      ? { establishedCount: memory.establishedFacts, disputedCount: memory.disputedFacts, href: "#journey-memory" }
      : null,
    // null means that source visibility was not granted. It must not be turned into a zero count.
    sources: memory?.activeSources != null && memory.activeSources > 0 ? { activeCount: memory.activeSources, href: "#journey-memory" } : null,
    peopleAndRoles: input.participantCount > 0 || input.activeRoleCount > 0 || input.vacantRoleCount > 0
      ? { participantCount: input.participantCount, activeRoleCount: input.activeRoleCount, vacantRoleCount: input.vacantRoleCount, href: "#people" }
      : null,
    clarifications: [
      ...clarification("proposed-fact", memory?.proposedFacts ?? 0, "1 fait reste à confirmer", `${memory?.proposedFacts ?? 0} faits restent à confirmer`),
      ...clarification("disputed-fact", memory?.disputedFacts ?? 0, "1 fait est contesté", `${memory?.disputedFacts ?? 0} faits sont contestés`),
      ...clarification("draft-decision", memory?.draftDecisions ?? 0, "1 décision reste à confirmer", `${memory?.draftDecisions ?? 0} décisions restent à confirmer`),
      ...clarification("disputed-decision", memory?.disputedDecisions ?? 0, "1 décision fait l’objet d’une contestation", `${memory?.disputedDecisions ?? 0} décisions font l’objet d’une contestation`),
      ...clarification("expected-document", missingDocuments, "1 document est encore attendu", `${missingDocuments} documents sont encore attendus`),
      ...clarification("vacant-role", input.vacantRoleCount, "1 rôle reste à pourvoir", `${input.vacantRoleCount} rôles restent à pourvoir`),
      ...clarification("pending-review", input.pendingReviewCount, "1 revue humaine est en cours", `${input.pendingReviewCount} revues humaines sont en cours`),
      ...clarification("unscheduled-meeting", input.unscheduledMeetingCount, "1 réunion préparée n’a pas de date", `${input.unscheduledMeetingCount} réunions préparées n’ont pas de date`),
      ...clarification("meeting-without-participant", input.meetingWithoutParticipantCount, "1 réunion n’a pas encore de participant prévu", `${input.meetingWithoutParticipantCount} réunions n’ont pas encore de participant prévu`),
    ],
    nextMeeting: nextMeeting ? { id: nextMeeting.id, title: nextMeeting.title, scheduledAt: nextMeeting.scheduledAt, href: `#meeting-${nextMeeting.id}` } : null,
  };
}
