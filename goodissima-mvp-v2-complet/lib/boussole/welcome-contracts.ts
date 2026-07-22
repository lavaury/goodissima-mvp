import type { BoussolePageState } from "./contracts.ts";

export const WELCOME_PAGE_ID = "welcome-discovery" as const;
export const WELCOME_MANIFEST_VERSION = 1 as const;
export const WELCOME_APPLICABLE_STATE: BoussolePageState = "EMPTY";

export const WELCOME_MODES = ["DISCOVER", "DIRECT", "HELP"] as const;
export type WelcomeMode = (typeof WELCOME_MODES)[number];

export const WELCOME_JOURNEY_IDS = ["welcome-discover", "welcome-direct", "welcome-orient"] as const;
export type WelcomeJourneyId = (typeof WELCOME_JOURNEY_IDS)[number];

export const WELCOME_JOURNEY_VERSIONS: Record<WelcomeJourneyId, 1> = {
  "welcome-discover": 1,
  "welcome-direct": 1,
  "welcome-orient": 1,
};

export const WELCOME_STEP_IDS = {
  "welcome-discover": [
    "welcome-situation",
    "welcome-principle",
    "welcome-human-control",
    "welcome-entry-points",
    "welcome-first-action",
    "welcome-handoff",
  ],
  "welcome-direct": [
    "welcome-direct-choices",
    "welcome-direct-confirmation",
    "welcome-direct-handoff",
  ],
  "welcome-orient": [
    "welcome-orient-goal",
    "welcome-orient-recommendation",
    "welcome-orient-limit",
    "welcome-orient-handoff",
  ],
} as const satisfies Record<WelcomeJourneyId, readonly string[]>;

export type WelcomeStepId = (typeof WELCOME_STEP_IDS)[WelcomeJourneyId][number];

export const WELCOME_ENTRY_TARGET_IDS = [
  "welcome-entry-simple-link",
  "welcome-entry-opportunity",
  "welcome-entry-governed-journey",
  "welcome-entry-existing-activity",
] as const;

export type WelcomeEntryTargetId = (typeof WELCOME_ENTRY_TARGET_IDS)[number];

export const WELCOME_TARGET_IDS = [
  "welcome-mode-selector",
  "welcome-situation-illustration",
  "welcome-principle-illustration",
  "welcome-human-control-notice",
  "welcome-entry-simple-link",
  "welcome-entry-opportunity",
  "welcome-entry-governed-journey",
  "welcome-entry-existing-activity",
  "welcome-entry-help",
  "welcome-recommendation",
  "welcome-primary-navigation",
  "welcome-resume-controls",
] as const;

export type WelcomeTargetId = (typeof WELCOME_TARGET_IDS)[number];

export const WELCOME_ENTRY_KEYS = ["SIMPLE_LINK", "OPPORTUNITY", "GOVERNED_JOURNEY", "EXISTING_ACTIVITY"] as const;
export type WelcomeEntryKey = (typeof WELCOME_ENTRY_KEYS)[number];

export const WELCOME_INTENTS = [
  "RECEIVE_RESPONSES",
  "PUBLISH_NEED_OR_PROPOSAL",
  "COORDINATE_PEOPLE_AND_DECISIONS",
  "REVIEW_EXISTING_ACTIVITY",
  "UNSURE",
] as const;
export type WelcomeIntent = (typeof WELCOME_INTENTS)[number];

export type WelcomeEntry = {
  key: WelcomeEntryKey;
  stableId: WelcomeEntryTargetId;
  title: string;
  description: string;
  explanationOfGoodissimaTerm?: string;
  usageExample: string;
  humanControlNotice: string;
  route: "/links/simple" | "/opportunities/new" | "/gouvernance/nouveau" | "/dashboard";
  targetContextId: "simple-link" | "opportunities" | "new-governed-journey" | "dashboard";
  targetJourneyId: "start" | "choose-governed-format" | "repères" | null;
  contextualGuidanceStatus: "AVAILABLE" | "NEEDS_DEDICATED_JOURNEY";
  sortOrder: number;
};

export type WelcomeOrientationResult = {
  understoodGoal: string;
  recommendedEntry: WelcomeEntry | null;
  rationale: string;
  humanControlNotice: string;
  nextStep: string;
  alternativeAction?: string;
};
