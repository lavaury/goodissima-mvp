export type GovernedJourneyCockpitView = {
  relationTemplateId: string;
  extension: {
    createdAt: string;
    createdFromVersionLabel: string | null;
    hasLegacyEventLog: boolean;
    contextCount: number;
  } | null;
};

export function buildGovernedJourneyCockpitView(input: {
  relationTemplateId: string;
  extension: {
    id: string;
    relationCaseId: string | null;
    createdAt: string;
    createdFromTemplateVersionNumber: number | null;
  } | null;
  contextGovernedJourneyId: string | null;
  contextCount: number;
}): GovernedJourneyCockpitView {
  if (input.extension?.id !== (input.contextGovernedJourneyId ?? undefined)) {
    throw new Error("GOVERNED_JOURNEY_COCKPIT_READ_INCONSISTENT");
  }
  return {
    relationTemplateId: input.relationTemplateId,
    extension: input.extension ? {
      createdAt: input.extension.createdAt,
      createdFromVersionLabel: input.extension.createdFromTemplateVersionNumber === null
        ? null
        : `version ${input.extension.createdFromTemplateVersionNumber}`,
      hasLegacyEventLog: Boolean(input.extension.relationCaseId),
      contextCount: input.contextCount,
    } : null,
  };
}
