import type { BoussolePageState } from "./contracts.ts";
import {
  WELCOME_APPLICABLE_STATE,
  WELCOME_JOURNEY_IDS,
  WELCOME_JOURNEY_VERSIONS,
  WELCOME_MANIFEST_VERSION,
  WELCOME_PAGE_ID,
  WELCOME_STEP_IDS,
  WELCOME_TARGET_IDS,
  type WelcomeJourneyId,
  type WelcomeStepId,
} from "./welcome-contracts.ts";

export type WelcomeJourneyContract = {
  id: WelcomeJourneyId;
  version: 1;
  applicableStates: readonly BoussolePageState[];
  stepIds: readonly WelcomeStepId[];
};

export type WelcomeManifestContract = {
  pageId: typeof WELCOME_PAGE_ID;
  manifestVersion: 1;
  applicableStates: readonly BoussolePageState[];
  journeys: readonly WelcomeJourneyContract[];
  targetIds: typeof WELCOME_TARGET_IDS;
};

export const welcomeManifest: WelcomeManifestContract = {
  pageId: WELCOME_PAGE_ID,
  manifestVersion: WELCOME_MANIFEST_VERSION,
  applicableStates: [WELCOME_APPLICABLE_STATE],
  journeys: WELCOME_JOURNEY_IDS.map((id) => ({
    id,
    version: WELCOME_JOURNEY_VERSIONS[id],
    applicableStates: [WELCOME_APPLICABLE_STATE],
    stepIds: WELCOME_STEP_IDS[id],
  })),
  targetIds: WELCOME_TARGET_IDS,
};
