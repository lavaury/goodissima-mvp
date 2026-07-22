import type { WelcomeEntryKey, WelcomeIntent, WelcomeOrientationResult } from "./welcome-contracts.ts";
import { getWelcomeEntry } from "./welcome-content.ts";

const humanControlNotice = "La recommandation ne déclenche aucune création, publication, invitation, relation ou décision.";

const recommendations: Record<Exclude<WelcomeIntent, "UNSURE">, { entry: WelcomeEntryKey; goal: string; rationale: string }> = {
  RECEIVE_RESPONSES: {
    entry: "SIMPLE_LINK",
    goal: "Recevoir des réponses dans un cadre préparé.",
    rationale: "Un lien simple permet de préparer les informations à recueillir avant de décider de sa diffusion.",
  },
  PUBLISH_NEED_OR_PROPOSAL: {
    entry: "OPPORTUNITY",
    goal: "Présenter un besoin ou une proposition.",
    rationale: "Une opportunité permet de structurer ce que vous recherchez ou proposez avant toute publication.",
  },
  COORDINATE_PEOPLE_AND_DECISIONS: {
    entry: "GOVERNED_JOURNEY",
    goal: "Coordonner plusieurs personnes, étapes ou décisions.",
    rationale: "Un parcours gouverné fournit un cadre de suivi lorsque plusieurs responsabilités et validations sont nécessaires.",
  },
  REVIEW_EXISTING_ACTIVITY: {
    entry: "EXISTING_ACTIVITY",
    goal: "Retrouver et piloter une activité existante.",
    rationale: "Le Dashboard rassemble la vue d’ensemble et les accès vers les éléments réellement présents.",
  },
};

export function orientWelcomeIntent(intent: WelcomeIntent): WelcomeOrientationResult {
  if (intent === "UNSURE") {
    return {
      understoodGoal: "Vous souhaitez d’abord clarifier ce que Goodissima peut vous apporter.",
      recommendedEntry: null,
      rationale: "Aucune porte n’est sélectionnée tant que votre objectif n’est pas suffisamment clair.",
      humanControlNotice,
      nextStep: "Découvrir les principales manières de commencer ou parcourir les quatre choix.",
      alternativeAction: "Choisir manuellement une porte d’entrée.",
    };
  }

  const recommendation = recommendations[intent];
  return {
    understoodGoal: recommendation.goal,
    recommendedEntry: getWelcomeEntry(recommendation.entry),
    rationale: recommendation.rationale,
    humanControlNotice,
    nextStep: "Examiner la recommandation, puis choisir explicitement si vous souhaitez ouvrir la page correspondante.",
    alternativeAction: "Revenir aux quatre portes d’entrée.",
  };
}
