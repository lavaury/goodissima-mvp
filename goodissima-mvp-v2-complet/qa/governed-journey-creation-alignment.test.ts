import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const ai = loadTestModule<any>("lib/ai/governance/propose-journey-structure.ts", {
  "./router.ts": { routeAI: async (request: any) => ({ output: request.validateOutput(JSON.stringify({ name: "Parcours test", objective: "Objectif à clarifier", actors: [{ name: "Expert", role: "Conseil" }], documents: [], firstActions: [] })), provenance: { capability: request.capability, classification: request.classification } }) },
  "./types.ts": { AIGovernanceError: class AIGovernanceError extends Error { constructor(code: string) { super(code); } } },
});

test("creation need is classified and stripped of secrets, emails and internal identifiers", () => {
  const cleaned = ai.prepareJourneyCreationNeed("Organiser un comité avec jean@example.test, token=abc123 et identifiant 123e4567-e89b-12d3-a456-426614174000.");
  assert.equal(cleaned.classification, "CONFIDENTIAL");
  assert.doesNotMatch(cleaned.need, /abc123|jean@example|123e4567/);
  assert.equal(ai.prepareJourneyCreationNeed("Créer un parcours pour une situation de santé complexe.").classification, "SENSITIVE");
});

test("governed creation proposal validates structured output", () => {
  assert.equal(ai.validateJourneyStructure(JSON.stringify({ name: "Parcours", objective: "Cadrage", actors: [{ name: "Expert", role: "Conseil" }], documents: [], firstActions: [] })).actors[0].name, "Expert");
  assert.throws(() => ai.validateJourneyStructure("réponse libre"), /AI_OUTPUT_INVALID/);
  assert.throws(() => ai.validateJourneyStructure(JSON.stringify({ name: "Parcours", objective: "Cadrage", actors: "personnes", documents: [], firstActions: [] })), /AI_OUTPUT_INVALID/);
});

test("travel committee proposal rejects unrequested product framing in business fields", () => {
  const need = "Je veux créer un comité de voyage couvrant l'Europe et l'Asie.";
  const proposal = { name: "Comité de voyage Europe-Asie", objective: "Organiser les voyages en Europe et en Asie", actors: [{ name: "Responsable du comité", role: "Coordination des voyages" }], documents: [{ name: "Itinéraire prévisionnel", required: false }], firstActions: [{ title: "Définir les destinations", owner: "Responsable du comité" }] };
  assert.doesNotMatch(JSON.stringify(ai.validateJourneyStructure(JSON.stringify(proposal), need)), /Goodissima/i);
  assert.throws(() => ai.validateJourneyStructure(JSON.stringify({ ...proposal, objective: "Organiser les voyages selon les valeurs et processus Goodissima." }), need), /AI_OUTPUT_INVALID/);
  for (const leaked of [
    { ...proposal, name: "Parcours dans la plateforme" },
    { ...proposal, actors: [{ name: "Expert Mistral", role: "Conseil" }] },
    { ...proposal, documents: [{ name: "Table GovernedJourney", required: false }] },
    { ...proposal, firstActions: [{ title: "Configurer le workflow", owner: "Responsable du comité" }] },
  ]) assert.throws(() => ai.validateJourneyStructure(JSON.stringify(leaked), need), /AI_OUTPUT_INVALID/);
});

test("product subject explicitly supplied by the user remains a valid business topic", () => {
  const need = "Je veux créer un Parcours pour évaluer le déploiement de Goodissima.";
  const proposal = { name: "Évaluation de Goodissima", objective: "Évaluer le déploiement de Goodissima", actors: [], documents: [], firstActions: [] };
  assert.match(ai.validateJourneyStructure(JSON.stringify(proposal), need).objective, /Goodissima/);
});

test("v3 names the real-world subject, not the process of creating it", () => {
  assert.equal(ai.JOURNEY_STRUCTURE_PROMPT_VERSION, "governed-journey-structure-v3");
  const examples = [
    ["Je veux créer un comité de voyage couvrant l'Europe et l'Asie.", "Comité de voyage Europe-Asie"],
    ["Je veux préparer un congrès européen de cardiologie.", "Congrès européen de cardiologie"],
    ["Je veux créer un groupe de travail cybersécurité.", "Groupe de travail cybersécurité"],
    ["Je veux lancer une mission d'audit sécurité.", "Mission d'audit sécurité"],
    ["Je veux organiser un programme d'échange universitaire franco-allemand.", "Programme d'échange universitaire franco-allemand"],
    ["Je veux créer un parcours sur la création d'entreprise.", "Création d'entreprise"],
  ] as const;
  for (const [need, name] of examples) {
    assert.ok(ai.JOURNEY_STRUCTURE_SYSTEM.includes(name), `prompt example missing: ${name}`);
    assert.equal(ai.validateJourneyStructure(JSON.stringify({ name, objective: "Objectif métier", actors: [], documents: [], firstActions: [] }), need).name, name);
  }
  assert.match(ai.JOURNEY_STRUCTURE_SYSTEM, /N'ajoute aucune date, région, organisation ou qualification absente du besoin/);
});

test("v3 rejects unrequested administrative name prefixes without rewriting legitimate business terms", () => {
  const need = "Je veux créer un comité de voyage couvrant l'Europe et l'Asie.";
  for (const name of [
    "Cadrage initial pour la création d'un comité de voyage Europe-Asie",
    "Mise en place d'un comité de voyage Europe-Asie",
    "Création d'un comité de voyage Europe-Asie",
  ]) assert.throws(() => ai.validateJourneyStructure(JSON.stringify({ name, objective: "Objectif métier", actors: [], documents: [], firstActions: [] }), need), /AI_OUTPUT_INVALID/);
  const businessNeed = "Je veux créer un parcours sur la création d'entreprise.";
  assert.equal(ai.validateJourneyStructure(JSON.stringify({ name: "Création d'entreprise", objective: "Accompagner la création d'entreprise", actors: [], documents: [], firstActions: [] }), businessNeed).name, "Création d'entreprise");
});

test("provider details stay in provenance, never in unrequested business content", () => {
  const assistant = read("app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");
  assert.match(assistant, /Proposition IA : \{provenance\.provider\} \/ \{provenance\.model\}/);
  assert.match(assistant, /contrôles techniques appliqués par Goodissima/);
  const proposal = { name: "Comité de voyage", objective: "Organiser le comité", actors: [], documents: [], firstActions: [{ title: "Consulter le provider OpenAI", owner: "Organisateur" }] };
  assert.throws(() => ai.validateJourneyStructure(JSON.stringify(proposal), "Organiser un comité de voyage en Europe et en Asie."), /AI_OUTPUT_INVALID/);
});

test("governed creation request uses classified capability and returns provenance", async () => {
  const result = await ai.proposeJourneyStructure("Organiser une réunion du comité de pilotage.", "user-1");
  assert.equal(result.provenance.capability, "proposeJourneyStructure");
  assert.equal(result.provenance.classification, "CONFIDENTIAL");
  assert.equal(result.draft.actors[0].name, "Expert");
});

test("abstract actors are presented as roles, without automatic person, invitation or assignment", () => {
  const assistant = read("app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");
  const creation = read("lib/governance-journey-actions.ts");
  assert.match(assistant, /Rôles, profils ou responsabilités à prévoir/);
  assert.match(assistant, /ne désignent pas des personnes identifiées/);
  assert.doesNotMatch(creation, /governedJourneyInvitation\.create|governedJourneyConsent\.create|expectedRoleAssignment\.create/);
  assert.match(creation, /actors: participantActors/);
});

test("old snapshot keys remain readable while confidentiality and documents are labelled honestly", () => {
  const cockpit = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  const assistant = read("app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");
  assert.match(cockpit, /creationPlan\.participants \?\? creationPlan\.actors/);
  assert.match(cockpit, /creationPlan\.documents \?\? creationPlan\.expectedDocuments/);
  assert.match(cockpit, /Principes de confidentialité proposés/);
  assert.match(assistant, /ne remplacent pas les contrôles techniques/);
  assert.match(assistant, /pas automatiquement validé, ni qualifié comme Source ou Fait/);
  assert.match(cockpit, /Prévue à la création · Aucun état d’exécution suivi ici/);
});

test("workspace remains optional, first actions are not current state, and memory is not auto-created", () => {
  const creation = read("lib/governance-journey-actions.ts");
  const cockpit = read("app/(connected)/gouvernance/parcours/[id]/pilotage/page.tsx");
  assert.match(creation, /workspaceId: workspace\?\.id \?\? null/);
  assert.match(cockpit, /const currentActions = experience\.actions/);
  assert.doesNotMatch(creation, /governedMemoryFact\.create|governedMemoryDecision\.create|governedMemorySource\.create/);
  assert.match(read("app/(connected)/gouvernance/nouveau/GovernedJourneyEducationalPreview.tsx"), /Workspace éventuel/);
});

test("generation uses a classified governance capability and human approval remains mandatory", () => {
  const route = read("app/api/gouvernance/journey-ai-generate/route.ts");
  const capability = read("lib/ai/governance/propose-journey-structure.ts");
  const assistant = read("app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx");
  assert.match(route, /proposeJourneyStructure\(description, owner\.id\)/);
  assert.doesNotMatch(route, /generateTemplateDraft|getConfiguredAIProvider|Mistral/);
  assert.match(capability, /classification: prepared\.classification/);
  assert.match(capability, /await routeAI\(/);
  assert.match(capability, /validateOutput: \(output\) => validateJourneyStructure\(output, prepared\.need\)/);
  assert.match(assistant, /formData\.set\("requiresHumanValidation", "true"\)/);
  assert.match(assistant, /onClick=\{validateAndCreate\}/);
  assert.match(read("lib/ai/governance/registry.ts"), /!isProductionRuntime\(\)/);
});

test("Boussole tracks semantic review change without inventing a target", () => {
  assert.match(read("lib/boussole/registry.ts"), /"review-journey-proposal": 2/);
  assert.match(read("lib/boussole-new-governed-journey.ts"), /pas des personnes identifiées/);
});
