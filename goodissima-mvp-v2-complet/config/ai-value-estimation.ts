export const AI_VALUE_ESTIMATION_RULES = {
  id: "goodissima-ai-value-estimation",
  version: "1.0.0",
  owner: "AI Governance",
  approvedAt: "2026-06-14",
  reviewAfter: "2026-12-14",
  currency: "EUR",
  disclaimerFr: "Estimations conventionnelles, non mesurées. Elles ne constituent pas une promesse de gain réel.",
  timeSavedMinutes: {
    generatedTemplate: {
      minutes: 45,
      rationaleFr: "Préparation initiale estimée d'un brouillon structuré de parcours.",
    },
    optimizationProposal: {
      minutes: 20,
      rationaleFr: "Analyse et formulation estimées d'améliorations documentées.",
    },
    optimizedTemplateVersion: {
      minutes: 10,
      rationaleFr: "Création estimée d'une nouvelle version brouillon à partir d'une proposition approuvée.",
    },
  },
  featureSuccessfulOutcomeMinutes: {
    template_critic: 15,
    relation_summary: 8,
    risk_signals: 10,
    matching_analysis: 15,
    timeline_intelligence: 10,
    draft_assistant: 10,
  },
  estimatedValueIndexWeights: {
    validation: 0.5,
    optimizationAdoption: 0.3,
    optimizedConversion: 0.2,
  },
} as const;

export type AIValueEstimationRules = typeof AI_VALUE_ESTIMATION_RULES;

export const AI_VALUE_ESTIMATION_INPUT = {
  version: AI_VALUE_ESTIMATION_RULES.version,
  generatedTemplateMinutes: AI_VALUE_ESTIMATION_RULES.timeSavedMinutes.generatedTemplate.minutes,
  optimizationProposalMinutes: AI_VALUE_ESTIMATION_RULES.timeSavedMinutes.optimizationProposal.minutes,
  optimizedTemplateVersionMinutes: AI_VALUE_ESTIMATION_RULES.timeSavedMinutes.optimizedTemplateVersion.minutes,
  featureSuccessfulOutcomeMinutes: AI_VALUE_ESTIMATION_RULES.featureSuccessfulOutcomeMinutes,
  disclaimerFr: AI_VALUE_ESTIMATION_RULES.disclaimerFr,
};
