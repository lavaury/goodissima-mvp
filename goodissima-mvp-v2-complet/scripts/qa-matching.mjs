import process from "node:process";

const cities = ["Lille", "Lyon", "Paris", "Nantes", "Bordeaux"];
const types = ["T2", "T3", "T4"];

function makeProfile(kind, index) {
  const city = cities[index % cities.length];
  const type = types[index % types.length];
  const budget = `${800 + (index % 9) * 100} EUR`;

  if (kind === "candidate") {
    return {
      id: `candidate_${index}`,
      kind,
      matchingEnabled: true,
      pseudonym: `Candidat ${index}`,
      categories: ["immobilier"],
      interests: [type, index % 2 === 0 ? "revenus stables" : "visite"],
      constraints: index % 5 === 0 ? ["garant a verifier"] : [],
      location: city,
      budget,
      relationType: "real_estate_rental",
    };
  }

  if (kind === "offer") {
    return {
      id: `offer_${index}`,
      kind,
      matchingEnabled: true,
      pseudonym: `Offre ${index}`,
      categories: ["immobilier"],
      interests: [type, "visite"],
      constraints: index % 7 === 0 ? ["documents a verifier"] : [],
      location: city,
      budget,
      relationType: "real_estate_rental",
    };
  }

  if (kind === "investor") {
    return {
      id: `investor_${index}`,
      kind,
      matchingEnabled: true,
      pseudonym: `Investisseur ${index}`,
      categories: ["investisseur"],
      interests: [index % 2 === 0 ? "IA" : "B2B SaaS", "banque"],
      constraints: index % 4 === 0 ? ["timing a clarifier"] : [],
      relationType: "investor_introduction",
    };
  }

  return {
    id: `partner_${index}`,
    kind,
    matchingEnabled: true,
    pseudonym: `Partenaire ${index}`,
    categories: ["investisseur"],
    interests: ["B2B SaaS", index % 2 === 0 ? "banque" : "distribution"],
    constraints: index % 3 === 0 ? ["attentes a clarifier"] : [],
    relationType: "investor_introduction",
  };
}

function explain(source, candidate) {
  const compatibleElements = [];
  const clarificationsNeeded = [];
  const warnings = [];

  for (const category of source.categories) {
    if (candidate.categories.includes(category)) compatibleElements.push(`Categorie compatible: ${category}`);
  }
  for (const interest of source.interests) {
    if (candidate.interests.includes(interest)) compatibleElements.push(`Interet commun: ${interest}`);
  }
  if (source.location && candidate.location && source.location === candidate.location) {
    compatibleElements.push(`Localisation compatible: ${source.location}`);
  }
  if (source.budget && candidate.budget && source.budget === candidate.budget) {
    compatibleElements.push(`Budget compatible: ${source.budget}`);
  }
  if (source.constraints.length || candidate.constraints.length) clarificationsNeeded.push("Contraintes a clarifier.");
  if (compatibleElements.length === 0) warnings.push("Compatibilite faible.");
  if (compatibleElements.length > 0 && compatibleElements.length < 3) warnings.push("Correspondance ambigue.");

  return { compatibleElements, clarificationsNeeded, warnings };
}

function rank(source, candidates) {
  return candidates
    .filter((candidate) => candidate.matchingEnabled && candidate.relationType === source.relationType)
    .map((candidate) => ({ candidate, explanation: explain(source, candidate) }))
    .filter((match) => match.explanation.compatibleElements.length > 0)
    .sort((a, b) => b.explanation.compatibleElements.length - a.explanation.compatibleElements.length)
    .map(({ candidate, explanation }) => ({
      pseudonym: candidate.pseudonym,
      explanation,
    }));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const candidates = Array.from({ length: 100 }, (_, index) => makeProfile("candidate", index));
const offers = Array.from({ length: 50 }, (_, index) => makeProfile("offer", index));
const investors = Array.from({ length: 30 }, (_, index) => makeProfile("investor", index));
const partners = Array.from({ length: 20 }, (_, index) => makeProfile("partner", index));
const dataset = [...candidates, ...offers, ...investors, ...partners];

const strong = rank(candidates[0], offers)[0];
const weak = rank(candidates[1], offers).find((match) => match.explanation.warnings.length > 0);
const incompatible = rank(candidates[0], investors);
const ambiguous = rank(investors[1], partners).find((match) => match.explanation.warnings.length > 0);
const serialized = JSON.stringify([strong, weak, incompatible, ambiguous]);

assert(dataset.length === 200, "deterministic dataset contains 200 profiles");
assert(strong.explanation.compatibleElements.length >= 3, "strong_match has several compatible elements");
assert(Boolean(weak) && weak.explanation.clarificationsNeeded.length >= 1, "weak_match requests clarification");
assert(incompatible.length === 0, "incompatible_match is not prioritized");
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), "privacy_preserved has no email leak");
assert(!/\b(token|secret|signed url|score)\b/i.test(serialized), "no token, secret, signed URL or visible score");
assert(Boolean(ambiguous) && ambiguous.explanation.warnings.length >= 1, "ambiguous_match includes warning");

if (process.exitCode) {
  console.error("\nMatching QA failed.");
  process.exit(process.exitCode);
}

console.log("\nMatching QA passed: 200 deterministic profiles.");
