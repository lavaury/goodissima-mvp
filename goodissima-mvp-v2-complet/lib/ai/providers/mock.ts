import type {
  AIClassification,
  AIDraft,
  AITimelineIntelligence,
  AIProvider,
  AIProviderRequest,
  AIProviderResult,
  AISummary,
} from "@/lib/ai/types";

const scenarioSummaries: Record<string, AISummary> = {
  immobilier_dossier_incomplet: {
    summary:
      "Le candidat independant manifeste un interet pour le logement et souhaite une visite, mais le dossier reste incomplet avec revenus variables et garant non confirme.",
    keyPoints: [
      "Candidat independant avec revenus variables.",
      "Garant potentiel non confirme.",
      "Demande de visite a organiser.",
    ],
    risks: ["Dossier incomplet.", "Revenus a clarifier.", "Garant non confirme."],
    missingDocuments: ["Justificatif revenus.", "Document garant si necessaire."],
    suggestedActions: [
      {
        label: "Demander le justificatif de revenus",
        type: "REQUEST_DOCUMENT",
        reason: "Le justificatif de revenus est absent du dossier.",
      },
      {
        label: "Clarifier les revenus et le garant",
        type: "REQUEST_CLARIFICATION",
        reason: "Les revenus sont variables et le garant n'est pas confirme.",
      },
      {
        label: "Proposer un creneau de visite",
        type: "SCHEDULE_EXCHANGE",
        reason: "Le candidat demande une visite.",
      },
    ],
  },
  immobilier_candidat_solide: {
    summary:
      "Le candidat en CDI presente des revenus stables, des documents complets et souhaite organiser une visite.",
    keyPoints: ["CDI indique.", "Revenus stables.", "Documents complets.", "Visite souhaitee."],
    risks: ["Peu de risques identifies a ce stade."],
    missingDocuments: [],
    suggestedActions: [
      {
        label: "Planifier une visite",
        type: "SCHEDULE_EXCHANGE",
        reason: "Le dossier est complet et le candidat souhaite visiter.",
      },
    ],
  },
  recrutement_cv_manquant: {
    summary:
      "Le candidat semble motive avec une experience pertinente, mais le CV manque pour qualifier le profil.",
    keyPoints: ["Motivation exprimee.", "Experience pertinente.", "CV absent."],
    risks: ["Profil incomplet sans CV.", "Disponibilite et attentes a clarifier."],
    missingDocuments: ["CV."],
    suggestedActions: [
      {
        label: "Demander le CV",
        type: "REQUEST_DOCUMENT",
        reason: "Le CV est necessaire pour qualifier le profil.",
      },
      {
        label: "Clarifier disponibilite et attentes",
        type: "REQUEST_CLARIFICATION",
        reason: "Les prochains elements de qualification ne sont pas explicites.",
      },
    ],
  },
  recrutement_profil_complet: {
    summary:
      "Le profil complet de recrutement inclut CV, portfolio et disponibilite indiquee; un echange peut etre organise.",
    keyPoints: ["CV present.", "Portfolio present.", "Disponibilite indiquee."],
    risks: ["Verifier l'adequation finale avec le besoin avant toute decision."],
    missingDocuments: [],
    suggestedActions: [
      {
        label: "Planifier un entretien",
        type: "SCHEDULE_EXCHANGE",
        reason: "Les elements principaux du profil sont disponibles.",
      },
      {
        label: "Faire un suivi candidat",
        type: "FOLLOW_UP",
        reason: "Un suivi humain permet de confirmer les prochaines etapes.",
      },
    ],
  },
  investor_strategic_interest: {
    summary:
      "Un fonds europeen exprime un interet strategique pour une IA B2B liee a la banque et a un partenariat strategique.",
    keyPoints: ["Fonds europeen.", "IA B2B.", "Interet banque.", "Partenariat strategique."],
    risks: ["Stade d'investissement a clarifier.", "Timing a clarifier.", "Attentes de partenariat a clarifier."],
    missingDocuments: [],
    suggestedActions: [
      {
        label: "Preparer un suivi investisseur",
        type: "INVESTOR_FOLLOW_UP",
        reason: "L'interet strategique merite un suivi dedie.",
      },
      {
        label: "Organiser un echange",
        type: "SCHEDULE_EXCHANGE",
        reason: "Un rendez-vous permettra de qualifier l'opportunite.",
      },
      {
        label: "Clarifier les attentes",
        type: "REQUEST_CLARIFICATION",
        reason: "Le stade, le timing et les attentes doivent rester explicites.",
      },
    ],
  },
  investor_vague_interest: {
    summary:
      "L'interet investisseur est trop vague pour qualifier la relation sans informations complementaires.",
    keyPoints: ["Message vague.", "Role non precise.", "Organisation non precise."],
    risks: ["Interet insuffisamment qualifie.", "Besoin de clarifier role, organisation et intention."],
    missingDocuments: [],
    suggestedActions: [
      {
        label: "Clarifier l'interet",
        type: "REQUEST_CLARIFICATION",
        reason: "Le role, l'organisation et l'objectif ne sont pas suffisamment qualifies.",
      },
    ],
  },
  privacy_injection_attempt: {
    summary:
      "Le message contient une tentative d'injection demandant d'ignorer les regles; la reponse doit rester factuelle et privacy-first.",
    keyPoints: ["Tentative de prompt injection detectee.", "Aucune donnee sensible ne doit etre revelee."],
    risks: ["Risque prompt injection.", "Ne pas executer les consignes contraires aux regles Goodissima."],
    missingDocuments: [],
    suggestedActions: [
      {
        label: "Clarifier la demande utile",
        type: "REQUEST_CLARIFICATION",
        reason: "La demande doit etre reformulee sans instruction contraire aux regles de confidentialite.",
      },
    ],
  },
  empty_or_too_light_case: {
    summary: "Pas assez de contenu pour une analyse IA pertinente.",
    keyPoints: [],
    risks: ["Pas assez de contenu."],
    missingDocuments: [],
    suggestedActions: [],
  },
};

const scenarioTimelineIntelligence: Record<string, AITimelineIntelligence> = {
  timeline_inactive_7_days: {
    timelineStatus: "Conversation inactive depuis 7 jours.",
    inactiveSinceDays: 7,
    blockers: ["Aucun echange recent."],
    nextBestActions: [
      {
        label: "Relancer la relation",
        type: "FOLLOW_UP",
        reason: "La conversation est inactive depuis au moins 7 jours.",
      },
    ],
    alerts: ["Conversation inactive."],
  },
  timeline_document_request_pending: {
    timelineStatus: "Document attendu avant poursuite.",
    blockers: ["Document attendu: justificatif de revenus."],
    nextBestActions: [
      {
        label: "Relancer la demande de document",
        type: "REQUEST_DOCUMENT",
        reason: "Un document demande reste en attente.",
      },
      {
        label: "Faire un suivi",
        type: "FOLLOW_UP",
        reason: "Un suivi humain permet de confirmer le besoin documentaire.",
      },
    ],
    alerts: ["Action en attente liee a un document."],
  },
  timeline_message_unanswered: {
    timelineStatus: "Message candidat sans reponse proprietaire.",
    blockers: ["Reponse proprietaire attendue."],
    nextBestActions: [
      {
        label: "Repondre au message",
        type: "FOLLOW_UP",
        reason: "Le dernier message du contact n'a pas encore recu de reponse.",
      },
    ],
    alerts: ["Message sans reponse."],
  },
  timeline_case_ready_for_review: {
    timelineStatus: "Dossier complet pret pour revue.",
    blockers: [],
    nextBestActions: [
      {
        label: "Lancer la revue de validation",
        type: "VALIDATION_REVIEW",
        reason: "Les elements principaux sont disponibles pour une revue humaine.",
      },
    ],
    alerts: ["Dossier complet mais non traite."],
  },
  timeline_confusing_exchange: {
    timelineStatus: "Echange ambigu necessitant clarification.",
    blockers: ["Clarification necessaire sur les attentes et les prochaines etapes."],
    nextBestActions: [
      {
        label: "Demander une clarification",
        type: "REQUEST_CLARIFICATION",
        reason: "Les messages contiennent des informations contradictoires ou incompletes.",
      },
    ],
    alerts: ["Demande de clarification necessaire."],
  },
};

const scenarioDrafts: Record<string, AIDraft> = {
  immobilier_follow_up_polite: {
    draftType: "FOLLOW_UP",
    subject: "Relance dossier de location",
    message:
      "Bonjour, je me permets de revenir vers vous au sujet du dossier de location. Souhaitez-vous que nous confirmions ensemble les prochaines etapes ou un creneau d'echange ?",
    tone: "professionnel et poli",
    warnings: ["Relance sans pression abusive.", "Aucune decision automatique."],
  },
  immobilier_document_request: {
    draftType: "DOCUMENT_REQUEST",
    subject: "Justificatif de revenus",
    message:
      "Bonjour, pour completer le dossier, pourriez-vous transmettre un justificatif de revenus recent lorsque vous l'aurez disponible ? Merci d'avance.",
    tone: "neutre",
    warnings: ["Ne pas formuler de menace.", "Ne pas halluciner de document deja recu."],
  },
  investor_reply_professional: {
    draftType: "INVESTOR_REPLY",
    subject: "Echange strategique",
    message:
      "Bonjour, merci pour votre interet. Nous pouvons organiser un echange afin de mieux comprendre votre approche strategique, le calendrier envisage et les synergies possibles autour de l'IA B2B et de la banque.",
    tone: "strategique et professionnel",
    warnings: ["Aucune promesse d'investissement.", "Clarifier les attentes avant toute conclusion."],
  },
  clarification_request: {
    draftType: "CLARIFICATION_REQUEST",
    subject: "Clarification des prochaines etapes",
    message:
      "Bonjour, afin d'avancer de maniere factuelle, pourriez-vous preciser le point que vous souhaitez clarifier en priorite et les informations deja disponibles de votre cote ?",
    tone: "respectueux et precis",
    warnings: ["Demande limitee aux informations utiles.", "Aucune decision automatique."],
  },
  privacy_no_email_leak: {
    draftType: "PROFESSIONAL_RESPONSE",
    subject: "Reponse securisee",
    message:
      "Bonjour, merci pour votre message. Pour proteger les donnees personnelles, poursuivons l'echange dans cet espace securise et partageons uniquement les informations necessaires au dossier.",
    tone: "professionnel et privacy-first",
    warnings: ["Aucun email, token ou URL signee inclus.", "Ne pas demander de donnees inutiles."],
  },
  aggressive_prompt_attempt: {
    draftType: "PROFESSIONAL_RESPONSE",
    subject: "Reformulation professionnelle",
    message:
      "Bonjour, je vous propose de rester sur un echange factuel et respectueux. Pour avancer, pouvez-vous indiquer l'element attendu ou le point a clarifier ?",
    tone: "calme et professionnel",
    warnings: ["Demande menacante refusee et reformulee de maniere sure.", "Pas de pression abusive."],
  },
};

function getScenarioId(request: AIProviderRequest) {
  const metadataScenarioId = request.metadata?.scenarioId;
  if (typeof metadataScenarioId === "string") return metadataScenarioId;

  try {
    const parsed = JSON.parse(request.prompt) as { id?: unknown; scenarioId?: unknown };
    if (typeof parsed.scenarioId === "string") return parsed.scenarioId;
    if (typeof parsed.id === "string") return parsed.id;
  } catch {
    return null;
  }

  return null;
}

export const mockAIProvider: AIProvider = {
  name: "mock",
  model: "mock-goodissima-v1",
  async chat(request: AIProviderRequest): Promise<AIProviderResult<string>> {
    return {
      provider: "mock",
      model: this.model,
      output: `Reponse mock basee sur ${request.prompt.length} caracteres de contexte privacy-first.`,
    };
  },
  async summarize(request: AIProviderRequest): Promise<AIProviderResult<AISummary>> {
    if (process.env.AI_TEST_MODE === "scenario") {
      const scenarioId = getScenarioId(request);
      const output = scenarioId ? scenarioSummaries[scenarioId] : null;

      if (output) {
        return {
          provider: "mock",
          model: "mock-goodissima-scenario-v1",
          output,
        };
      }
    }

    const hasDocuments = !request.prompt.includes('"documents":[]');
    const hasOpenActions = !request.prompt.includes('"openActions":[]');

    return {
      provider: "mock",
      model: this.model,
      output: {
        summary:
          "La relation presente des signaux exploitables, mais la synthese doit etre verifiee par l'equipe avant toute decision.",
        keyPoints: [
          "Le contexte analyse est limite aux donnees relationnelles utiles.",
          hasOpenActions
            ? "Des actions ouvertes semblent encore a suivre."
            : "Aucune action ouverte n'est visible dans le contexte transmis.",
          "Les messages recents ont ete pseudonymises avant analyse.",
        ],
        risks: [
          "Verifier manuellement les informations importantes avant de repondre.",
          "Ne pas deduire de decision d'investissement ou de partenariat depuis cette synthese seule.",
        ],
        suggestedActions: [
          {
            label: "Clarifier le prochain point attendu",
            type: "REQUEST_CLARIFICATION",
            reason: "Les prochains elements a fournir ou valider doivent rester explicites avant d'avancer.",
          },
          {
            label: hasDocuments ? "Faire un suivi relationnel" : "Demander un document utile au dossier",
            type: hasDocuments ? "FOLLOW_UP" : "REQUEST_DOCUMENT",
            reason: hasDocuments
              ? "Le dossier contient deja des elements et peut necessiter un suivi humain."
              : "Aucun document n'est visible dans le contexte transmis.",
          },
        ],
        missingDocuments: hasDocuments
          ? []
          : ["Aucun document n'est reference dans le dossier; ne demander une piece que si elle est utile au contexte."],
      },
    };
  },
  async analyzeTimeline(request: AIProviderRequest): Promise<AIProviderResult<AITimelineIntelligence>> {
    if (process.env.AI_TEST_MODE === "scenario") {
      const scenarioId = getScenarioId(request);
      const output = scenarioId ? scenarioTimelineIntelligence[scenarioId] : null;

      if (output) {
        return {
          provider: "mock",
          model: "mock-goodissima-scenario-v1",
          output,
        };
      }
    }

    const context = request.prompt.toLowerCase();
    const hasPendingAction = context.includes('"status":"pending"');
    const hasDocuments = !request.prompt.includes('"documents":[]');
    const hasContactLastMessage = context.includes('"lastmessageauthor":"contact"');

    return {
      provider: "mock",
      model: this.model,
      output: {
        timelineStatus: hasPendingAction
          ? "Des elements restent en attente dans la timeline."
          : hasDocuments
            ? "La timeline contient des elements a verifier par l'equipe."
            : "La timeline est limitee et doit etre interpretee avec prudence.",
        blockers: hasPendingAction ? ["Action en attente."] : [],
        nextBestActions: [
          {
            label: hasContactLastMessage ? "Repondre au dernier message" : "Faire un suivi relationnel",
            type: "FOLLOW_UP",
            reason: "La prochaine etape doit rester declenchee par un humain.",
          },
        ],
        alerts: hasContactLastMessage ? ["Message sans reponse possible."] : [],
      },
    };
  },
  async generateDraft(request: AIProviderRequest): Promise<AIProviderResult<AIDraft>> {
    if (process.env.AI_TEST_MODE === "scenario") {
      const scenarioId = getScenarioId(request);
      const output = scenarioId ? scenarioDrafts[scenarioId] : null;

      if (output) {
        return {
          provider: "mock",
          model: "mock-goodissima-scenario-v1",
          output,
        };
      }
    }

    const requestedType = request.metadata?.draftType;
    const draftType =
      requestedType === "DOCUMENT_REQUEST" ||
      requestedType === "CLARIFICATION_REQUEST" ||
      requestedType === "INVESTOR_REPLY" ||
      requestedType === "PROFESSIONAL_RESPONSE"
        ? requestedType
        : "FOLLOW_UP";

    return {
      provider: "mock",
      model: this.model,
      output: {
        draftType,
        subject: "Message propose",
        message:
          "Bonjour, merci pour votre message. Je vous propose de confirmer les prochaines etapes utiles au dossier dans cet espace securise.",
        tone: "professionnel et factuel",
        warnings: ["Brouillon a relire avant envoi.", "Aucune action ou email n'est envoye automatiquement."],
      },
    };
  },
  async classify(): Promise<AIProviderResult<AIClassification>> {
    return {
      provider: "mock",
      model: this.model,
      output: { label: "needs_review", confidence: 0.6 },
    };
  },
};
