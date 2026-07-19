export const BOUSSOLE_PAGE_STATES = ["EMPTY", "POPULATED", "FOCUSED"] as const;

export type BoussolePageState = (typeof BOUSSOLE_PAGE_STATES)[number];

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
};

export type BoussoleJourneyDefinition = {
  id: string;
  pageId: string;
  version: number;
  title: string;
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
