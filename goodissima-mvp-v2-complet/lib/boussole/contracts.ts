export const BOUSSOLE_PAGE_STATES = ["EMPTY", "POPULATED", "FOCUSED"] as const;

export type BoussolePageState = (typeof BOUSSOLE_PAGE_STATES)[number];

export type BoussoleObjectType = "WORKSPACE" | "GOVERNED_JOURNEY" | "PORTFOLIO" | "RELATION_CASE";

export type BoussoleTargetStrategy = {
  kind: "FIRST_VISIBLE_MATCH";
  objectType: BoussoleObjectType;
  functionalState?: string;
};

export type BoussoleRuntimeContext = {
  pageState: BoussolePageState;
  focusedObjectType?: BoussoleObjectType;
  focusedObjectId?: string;
  visibleObjectCount: number;
  availableTargetIds?: string[];
  functionalStates?: string[];
};

export type BoussoleStepDefinition = {
  id?: string;
  targetId?: string;
  title: string;
  body: string;
  detailedBody?: string;
  narration?: string;
  glossaryTermIds?: string[];
  optional?: boolean;
  fallbackTargetId?: string;
  targetStrategy?: BoussoleTargetStrategy;
};

export type BoussoleJourneyDefinition = {
  id: string;
  pageId: string;
  version: number;
  title: string;
  applicableStates: BoussolePageState[];
  steps: BoussoleStepDefinition[];
};

export type BoussolePageManifest = {
  pageId: string;
  version: number;
  routes: string[];
  supportedStates: BoussolePageState[];
  targets: string[];
  journeyIds: string[];
};
