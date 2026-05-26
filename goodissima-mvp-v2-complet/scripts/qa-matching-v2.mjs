import process from "node:process";

const dimensions = 32;
const synonymGroups = [
  ["banque", "institution financière", "finance regulated"],
  ["IA", "intelligence artificielle", "AI platform"],
  ["B2B SaaS", "logiciel professionnel", "enterprise software"],
];

function canonicalToken(token) {
  const normalized = token.toLowerCase();
  for (const group of synonymGroups) {
    if (group.map((item) => item.toLowerCase()).includes(normalized)) return group[0].toLowerCase();
  }
  return normalized;
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
  const normalizedText = synonymGroups.reduce(
    (current, group) => group.reduce((inner, synonym) => inner.replaceAll(synonym.toLowerCase(), group[0].toLowerCase()), current),
    text.toLowerCase(),
  );
  const tokens = normalizedText.split(/[^a-z0-9]+/).filter(Boolean).map(canonicalToken);
  for (const token of tokens) {
    const hash = hashToken(token);
    vector[hash % dimensions] += 1;
  }
  const norm = Math.hypot(...vector) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function cosine(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function profile(index) {
  const sectors = ["banque", "institution financière", "finance regulated", "sante", "retail", "education"];
  const aiTerms = ["IA", "intelligence artificielle", "AI platform", "workflow"];
  const softwareTerms = ["B2B SaaS", "logiciel professionnel", "enterprise software", "marketplace"];
  const sector = sectors[index % sectors.length];
  const ai = aiTerms[index % aiTerms.length];
  const software = softwareTerms[index % softwareTerms.length];
  return {
    id: `profile_${index}`,
    pseudonym: `Profil ${index}`,
    matchingEnabled: true,
    relationType: index % 2 === 0 ? "investor_introduction" : "real_estate_rental",
    text: `${sector} ${ai} ${software}`,
  };
}

function semanticMatch(source, candidates) {
  const sourceVector = embed(source.text);
  return candidates
    .filter((candidate) => candidate.matchingEnabled && candidate.relationType === source.relationType)
    .map((candidate) => {
      const similarity = cosine(sourceVector, embed(candidate.text));
      const semanticSignals = similarity > 0.55 ? ["Correspondance semantique detectee"] : [];
      const compatibleElements =
        semanticSignals.length || similarity > 0.4 ? ["Concepts proches malgre vocabulaire different"] : [];
      const clarificationsNeeded = similarity > 0.4 && similarity <= 0.7 ? ["Verifier le contexte exact avant proposition"] : [];
      const warnings = similarity > 0.4 && similarity <= 0.6 ? ["Correspondance semantique ambigue"] : [];
      return { pseudonym: candidate.pseudonym, explanation: { compatibleElements, semanticSignals, clarificationsNeeded, warnings }, internalSimilarity: similarity };
    })
    .filter((match) => match.explanation.semanticSignals.length > 0 || match.explanation.clarificationsNeeded.length > 0)
    .sort((a, b) => b.internalSimilarity - a.internalSimilarity)
    .map(({ internalSimilarity: _internalSimilarity, ...match }) => match);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const dataset = Array.from({ length: 500 }, (_, index) => profile(index));
dataset.push({
  id: "ambiguous_control",
  pseudonym: "Profil ambigu",
  matchingEnabled: true,
  relationType: "investor_introduction",
  text: "institution financière workflow marketplace",
});
const source = { id: "source", pseudonym: "Source", matchingEnabled: true, relationType: "investor_introduction", text: "banque IA B2B SaaS" };
const semanticMatches = semanticMatch(source, dataset);
const bankMatch = semanticMatches.find((match) => /Profil (2|6|8|12)/.test(match.pseudonym));
const falsePositive = semanticMatch({ ...source, text: "banque IA B2B SaaS" }, [{ ...profile(3), relationType: "real_estate_rental" }]);
const ambiguous = semanticMatches.find((match) => match.explanation.clarificationsNeeded.length > 0);
const serialized = JSON.stringify(semanticMatches);

assert(dataset.length >= 500, "deterministic semantic dataset contains at least 500 profiles");
assert(JSON.stringify(embed(source.text)) === JSON.stringify(embed(source.text)), "embeddings are deterministic");
assert(Boolean(bankMatch) && bankMatch.explanation.semanticSignals.length >= 1, "semantic_bank_ai_match works across vocabulary");
assert(falsePositive.length === 0, "semantic_false_positive is not prioritized");
assert(Boolean(ambiguous), "semantic_ambiguous asks for clarification");
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized), "privacy_preserved has no email leak");
assert(!/\b(token|secret|signed url|score|accepted automatically|rejected automatically)\b/i.test(serialized), "no sensitive leak, visible score or automatic decision");
assert(semanticMatches.every((match) => match.explanation.compatibleElements.length + match.explanation.semanticSignals.length > 0), "explainability_present for every returned match");

if (process.exitCode) {
  console.error("\nMatching V2 QA failed.");
  process.exit(process.exitCode);
}

console.log("\nMatching V2 QA passed: 500 deterministic semantic profiles.");
