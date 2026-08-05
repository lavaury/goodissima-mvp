export type GovernedJourneyRelationCaseContextView = {
  governedJourneyId: string;
  relationTemplateId: string;
  relationCaseId: string;
  createdAt: string;
};

export type GovernedJourneyRelationCaseContextResolution = {
  governedJourneyId: string | null;
  relationTemplateId: string;
  contexts: GovernedJourneyRelationCaseContextView[];
};

export type GovernedJourneyRelationCaseContextFormResolution = GovernedJourneyRelationCaseContextResolution & {
  formTemplateId: string;
};

export type AttachGovernedJourneyRelationCaseContextResult = {
  governedJourneyId: string;
  relationTemplateId: string;
  relationCaseId: string;
  createdAt: string;
  created: boolean;
};
