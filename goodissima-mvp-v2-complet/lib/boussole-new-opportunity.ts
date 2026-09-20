import type { CompassStep } from "./boussole-context.ts";
import type { BoussoleSequence } from "./boussole-dashboard.ts";

const step = (id: string, targetId: string, title: string, body: string): CompassStep => ({ id, targetId, title, body, detailedBody: body, glossaryTermIds: ["opportunite", "validation-humaine"], animation: { focus: "outline", movement: "scroll-center", narration: body, subtitles: body, duration: 7, transition: "soft-focus", tryNow: true } });

export const newOpportunitySequences: BoussoleSequence[] = [{
  id: "create-opportunity-draft",
  title: "Créer une opportunité simplement",
  description: "Décrire, vérifier puis créer un brouillon sans Parcours gouverné.",
  applicableStates: ["EMPTY", "POPULATED"],
  steps: [
    step("describe-opportunity", "opportunity-intent", "Décrire l’opportunité", "Indiquez naturellement ce que vous recherchez ou proposez. Rien n’est encore enregistré."),
    step("understand-opportunity", "understand-opportunity", "Comprendre la demande", "L’assistant peut proposer une structure, mais ne crée rien et ne choisit jamais silencieusement une intention ambiguë."),
    { ...step("review-opportunity", "opportunity-understood", "Vérifier la compréhension", "Relisez et corrigez chaque information comprise. Cette zone apparaît après une interprétation ou le choix de la saisie manuelle."), optional: true, fallbackTargetId: "opportunity-intent" },
    { ...step("validate-opportunity", "create-opportunity-draft", "Créer le brouillon", "Cette validation humaine explicite crée le brouillon. La Boussole ne déclenche jamais cette action."), optional: true, fallbackTargetId: "opportunity-intent" },
  ],
}];

export const newOpportunitySteps = newOpportunitySequences.flatMap((sequence) => sequence.steps);
