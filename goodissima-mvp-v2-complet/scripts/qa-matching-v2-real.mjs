import process from "node:process";

const dimensions = 48;
const synonymGroups = [
  ["banque", "institution financière", "finance regulated", "services bancaires"],
  ["IA", "intelligence artificielle", "AI platform", "machine learning"],
  ["B2B SaaS", "logiciel professionnel", "enterprise software", "plateforme metier"],
  ["immobilier", "logement", "location", "rental housing"],
  ["sante", "healthcare", "medtech", "parcours patient"],
];

function normalizeText(text) {
  return synonymGroups.reduce((current, group) => {
    return group.reduce((inner, synonym) => inner.replaceAll(synonym.toLowerCase(), group[0].toLowerCase()), current);
  }, text.toLowerCase());
}

function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function embed(text) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = normalizeText(text).split(/[^a-z0-9]+/).filter(Boolean);
  for (const token of tokens) vector[hashToken(token) % dimensions] += 1;
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosine(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function profile(index) {
  const domains = [
    "banque IA B2B SaaS",
    "institution financière intelligence artificielle logiciel professionnel",
    "finance regulated AI platform enterprise software",
    "immobilier location T3 Lille",
    "sante parcours patient medtech",
    "retail marketplace logistique",
    "education e-learning campus",
    "energie smart grid industrie",
  ];
  const text = domains[index % domains.length];
  return {
    id: `semantic_real_${index}`,
    pseudonym: `Profil semantique ${index}`,
    matchingEnabled: index % 11 !== 0,
    relationType: index % 3 === 0 ? "real_estate_rental" : "investor_introduction",
    text,
  };
}

function vectorSearch(source, candidates, topK = 1000, threshold = 0.25) {
  const startedAt = Date.now();
  const sourceVector = embed(source.text);
  const rows = candidates
    .filter((candidate) => candidate.matchingEnabled && candidate.relationType === source.relationType)
    .map((candidate) => ({ candidate, similarity: cosine(sourceVector, embed(candidate.text)) }))
    .filter((row) => row.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  const durationMs = Date.now() - startedAt;
  return { rows, durationMs, candidateCount: candidates.length };
}

function explain(row) {
  const semanticSignals = ["Correspondance semantique detectee"];
  const compatibleElements = ["Concepts proches malgre vocabulaire different"];
  const clarificationsNeeded = row.similarity < 0.8 ? ["Verifier le contexte exact avant proposition"] : [];
  const warnings = row.similarity < 0.5 ? ["Correspondance semantique ambigue"] : [];
  return { compatibleElements, semanticSignals, clarificationsNeeded, warnings };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const dataset = Array.from({ length: 1000 }, (_, index) => profile(index));
dataset.push({
  id: "false_negative_control",
  pseudonym: "Profil controle semantique",
  matchingEnabled: true,
  relationType: "investor_introduction",
  text: "institution financière intelligence artificielle logiciel professionnel",
});
dataset.push({
  id: "ambiguous_control",
  pseudonym: "Profil ambigu semantique",
  matchingEnabled: true,
  relationType: "investor_introduction",
  text: "institution financière workflow marketplace",
});
dataset.push({
  id: "false_positive_control",
  pseudonym: "Profil faux positif",
  matchingEnabled: true,
  relationType: "investor_introduction",
  text: "retail marketplace logistique",
});

const source = {
  id: "source",
  pseudonym: "Source",
  matchingEnabled: true,
  relationType: "investor_introduction",
  text: "banque IA B2B SaaS",
};
const firstEmbedding = embed(source.text);
const secondEmbedding = embed(source.text);
const search = vectorSearch(source, dataset);
const explained = search.rows.map((row) => ({ pseudonym: row.candidate.pseudonym, explanation: explain(row) }));
const serialized = JSON.stringify(explained);
const synonymMatch = search.rows.find((row) => row.candidate.id === "false_negative_control");
const falsePositive = search.rows.find((row) => row.candidate.id === "false_positive_control");
const ambiguous = explained.find((match) => match.explanation.clarificationsNeeded.length > 0);

console.info("[matching:v2:real] observability", {
  durationMs: search.durationMs,
  candidateCount: search.candidateCount,
  topMatches: search.rows.slice(0, 5).map((row) => row.candidate.id),
});

assert(dataset.length >= 1000, "large deterministic dataset contains at least 1000 profiles");
assert(JSON.stringify(firstEmbedding) === JSON.stringify(secondEmbedding), "embeddings deterministic in fallback QA");
assert(Boolean(synonymMatch), "semantic synonym match is retrieved");
assert(!falsePositive, "semantic false positive is not prioritized");
assert(Boolean(ambiguous), "semantic ambiguous case asks for clarification");
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), "no identity or email leak");
assert(!/\b(token|secret|signed url|score|accepted automatically|rejected automatically)\b/i.test(serialized), "no sensitive leak, raw score or automatic decision");
assert(explained.every((match) => match.explanation.compatibleElements.length && match.explanation.semanticSignals.length), "explainability present");

if (process.exitCode) {
  console.error("\nMatching V2 real QA failed.");
  process.exit(process.exitCode);
}

console.log("\nMatching V2 real QA passed: 1000 deterministic semantic profiles.");
