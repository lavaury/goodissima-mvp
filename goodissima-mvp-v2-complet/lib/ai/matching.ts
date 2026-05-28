export type AIMatchingProfile = {
  categories: string[];
  interests: string[];
  constraints: string[];
  location?: string;
  budget?: string;
  availability?: string;
  relationType?: string;
};

export type AIMatchExplanation = {
  compatibleElements: string[];
  clarificationsNeeded: string[];
  warnings: string[];
};

export type AIMatchCandidate = {
  id: string;
  pseudonym: string;
  templateKey: string | null;
  profile: AIMatchingProfile;
};

const cityWords = ["lille", "lyon", "paris", "bordeaux", "nantes", "marseille", "toulouse"];

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function extractMatchingProfile(input: {
  templateKey?: string | null;
  templateName?: string | null;
  title: string;
  messages: string[];
  documents: string[];
  aiInstructions?: string | null;
}): AIMatchingProfile {
  const text = [input.templateKey, input.templateName, input.title, input.aiInstructions, ...input.messages, ...input.documents]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const categories: string[] = [];
  const interests: string[] = [];
  const constraints: string[] = [];

  if (text.includes("appartement") || text.includes("loyer") || text.includes("location")) categories.push("immobilier");
  if (text.includes("invest") || text.includes("fonds")) categories.push("investisseur");
  if (text.includes("banque")) interests.push("banque");
  if (text.includes("b2b") || text.includes("saas")) interests.push("B2B SaaS");
  if (text.includes("ia") || text.includes("ai")) interests.push("IA");
  if (text.includes("t3")) interests.push("T3");
  if (text.includes("t2")) interests.push("T2");
  if (text.includes("garant")) constraints.push("garant a verifier");
  if (text.includes("revenus variables") || text.includes("variable")) constraints.push("revenus variables");
  if (text.includes("cdi")) interests.push("revenus stables");

  const location = cityWords.find((city) => text.includes(city));
  const budgetMatch = text.match(/(\d{3,4})\s?(eur|€)/i);

  return {
    categories: unique(categories),
    interests: unique(interests),
    constraints: unique(constraints),
    location: location ? location[0].toUpperCase() + location.slice(1) : undefined,
    budget: budgetMatch ? `${budgetMatch[1]} EUR` : undefined,
    availability: text.includes("samedi") ? "samedi" : text.includes("2 mois") ? "sous 2 mois" : undefined,
    relationType: input.templateKey ?? input.templateName ?? undefined,
  };
}

export function explainMatch(source: AIMatchingProfile, candidate: AIMatchingProfile): AIMatchExplanation {
  const compatibleElements: string[] = [];
  const clarificationsNeeded: string[] = [];
  const warnings: string[] = [];

  for (const category of source.categories) {
    if (candidate.categories.includes(category)) compatibleElements.push(`Categorie compatible: ${category}`);
  }

  for (const interest of source.interests) {
    if (candidate.interests.includes(interest)) compatibleElements.push(`Interet commun: ${interest}`);
  }

  if (source.location && candidate.location && source.location === candidate.location) {
    compatibleElements.push(`Localisation compatible: ${source.location}`);
  }

  if (!source.location || !candidate.location) clarificationsNeeded.push("Localisation a clarifier.");
  if (source.constraints.length || candidate.constraints.length) {
    clarificationsNeeded.push("Contraintes a verifier avant proposition.");
  }
  if (compatibleElements.length === 0) warnings.push("Compatibilite faible dans les informations disponibles.");
  if (compatibleElements.length > 0 && clarificationsNeeded.length > 0) {
    warnings.push("Des informations complementaires pourraient etre utiles.");
  }

  return {
    compatibleElements,
    clarificationsNeeded,
    warnings,
  };
}

export function rankMatches(source: AIMatchingProfile, candidates: AIMatchCandidate[]) {
  return candidates
    .map((candidate) => {
      const explanation = explainMatch(source, candidate.profile);
      return {
        candidate,
        explanation,
        internalRank: explanation.compatibleElements.length * 2 - explanation.warnings.length,
      };
    })
    .filter((match) => match.explanation.compatibleElements.length > 0)
    .sort((a, b) => b.internalRank - a.internalRank)
    .slice(0, 8)
    .map(({ candidate, explanation }) => ({
      relationId: candidate.id,
      pseudonym: candidate.pseudonym,
      explanation,
    }));
}
