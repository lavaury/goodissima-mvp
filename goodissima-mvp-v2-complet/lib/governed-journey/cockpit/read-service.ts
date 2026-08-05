import {
  governedJourneyReadService,
  type createGovernedJourneyReadService,
} from "../read/service.ts";
import {
  governedJourneyRelationCaseContextService,
  type createGovernedJourneyRelationCaseContextService,
} from "../context/service.ts";
import {
  buildGovernedJourneyCockpitView,
  type GovernedJourneyCockpitView,
} from "./read-model.ts";

export type { GovernedJourneyCockpitView } from "./read-model.ts";

type JourneyReadService = ReturnType<typeof createGovernedJourneyReadService>;
type ContextReadService = ReturnType<typeof createGovernedJourneyRelationCaseContextService>;

export function createGovernedJourneyCockpitReadService(
  journeyService: JourneyReadService = governedJourneyReadService,
  contextService: ContextReadService = governedJourneyRelationCaseContextService,
) {
  return {
    async read(input: {
      formTemplateId: string;
      workspaceId: string;
      requesterUserId: string;
    }): Promise<GovernedJourneyCockpitView> {
      const [journey, contexts] = await Promise.all([
        journeyService.findOptionalByFormTemplateId(input),
        contextService.listByFormTemplateId(input),
      ]);

      if (journey.relationTemplateId !== contexts.relationTemplateId) {
        throw new Error("GOVERNED_JOURNEY_COCKPIT_READ_INCONSISTENT");
      }
      return buildGovernedJourneyCockpitView({
        relationTemplateId: journey.relationTemplateId,
        extension: journey.ledger,
        contextGovernedJourneyId: contexts.governedJourneyId,
        contextCount: contexts.contexts.length,
      });
    },
  };
}

export const governedJourneyCockpitReadService = createGovernedJourneyCockpitReadService();
