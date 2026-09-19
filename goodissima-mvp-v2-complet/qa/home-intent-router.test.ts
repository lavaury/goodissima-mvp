import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTestModule } from "./helpers/load-test-module.ts";
import { HOME_INTENT_DESTINATIONS, homeIntentChoice, isSafeHomeDestination } from "../lib/home-intent.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
class GovernanceError extends Error { code: string; constructor(code: string) { super(code); this.code = code; } }
const ai = loadTestModule<any>("lib/ai/governance/interpret-home-intent.ts", {
  "./router.ts": { routeAI: async (request: any) => ({ output: request.validateOutput(JSON.stringify({ intent: "SEARCH_DIRECTORY", reformulation: "Chercher les anciens de ma promo 1957", confidenceBand: "HIGH", proposedParameters: { query: "promo 1957" } })), provenance: { capability: request.capability } }) },
  "./types.ts": { AIGovernanceError: GovernanceError },
  "../../home-intent.ts": { HOME_INTENTS: ["RESUME_WORK", "CREATE_GOVERNED_JOURNEY", "CREATE_SIMPLE_LINK", "CREATE_OPPORTUNITY", "SEARCH_DIRECTORY", "OPEN_MY_SPACES", "OPEN_EXISTING_OBJECT", "UNKNOWN", "AMBIGUOUS"] },
});
const parsed = (intent: string, proposedParameters: object = {}, extras: object = {}) => JSON.stringify({ intent, reformulation: "Une demande concrète", confidenceBand: "HIGH", proposedParameters, ...extras });

test("the model returns known intents and application registry owns every route", () => {
  for (const [intent, path] of Object.entries({ CREATE_GOVERNED_JOURNEY: "/gouvernance/nouveau", CREATE_SIMPLE_LINK: "/links/simple", CREATE_OPPORTUNITY: "/opportunities/new", SEARCH_DIRECTORY: "/annuaire", OPEN_MY_SPACES: "/gouvernance", RESUME_WORK: "/gouvernance" })) {
    assert.equal(HOME_INTENT_DESTINATIONS[intent as keyof typeof HOME_INTENT_DESTINATIONS].href, path);
    assert.equal(ai.validateHomeIntentOutput(parsed(intent, intent.startsWith("CREATE") ? { need: "Besoin exprimé" } : intent === "SEARCH_DIRECTORY" ? { query: "promo 1957" } : {}), "Demande utilisateur").intent, intent);
  }
  assert.equal(homeIntentChoice("CREATE_GOVERNED_JOURNEY").kind, "CREATION");
  assert.equal(homeIntentChoice("SEARCH_DIRECTORY").kind, "NAVIGATION");
  assert.equal(isSafeHomeDestination("https://elsewhere.test"), false);
  assert.equal(isSafeHomeDestination("//elsewhere.test"), false);
});

test("directory interpretation keeps an untrusted natural query, not arbitrary criteria", () => {
  const output = ai.validateHomeIntentOutput(parsed("SEARCH_DIRECTORY", { query: "anciens de ma promo 1957" }), "Chercher les anciens de ma promo 1957");
  assert.equal(output.proposedParameters.query, "anciens de ma promo 1957");
  assert.throws(() => ai.validateHomeIntentOutput(parsed("SEARCH_DIRECTORY", { promotion: "1957" }), "promo 1957"), /AI_OUTPUT_INVALID/);
  const directory = read("components/directory/DirectoryExperience.tsx");
  assert.match(directory, /consumeHomeIntentPrefill\("SEARCH_DIRECTORY"\)/);
  assert.match(directory, /\/api\/directory\/interpret-search/);
  assert.doesNotMatch(read("app/api/home/interpret/route.ts"), /prisma\.directoryProfile|\/api\/directory\/search/);
});

test("clear resume-work variants recover from UNKNOWN without inventing a last object", () => {
  for (const text of ["Reprendre où j'en étais", "Reprendre là où j'en étais", "Reprendre ma dernière activité", "Continuer où j'en étais", "Continuer mon travail", "Reprendre mon travail"]) {
    const output = ai.validateHomeIntentOutput(parsed("UNKNOWN"), text);
    assert.equal(output.intent, "RESUME_WORK", text);
    assert.equal(output.reformulation, text);
    assert.equal(output.confidenceBand, "HIGH");
    assert.equal(homeIntentChoice(output.intent).href, "/gouvernance");
  }
  assert.equal(ai.validateHomeIntentOutput(parsed("UNKNOWN"), "Je ne veux pas reprendre mon travail").intent, "UNKNOWN");
});

test("home prompt requires faithful reformulation of directory and all other intents", () => {
  const source = ai.HOME_INTENT_SYSTEM as string;
  assert.match(source, /sans ajouter de fait, de relation, de critère ou de contexte non exprimé/);
  assert.match(source, /même formation que l'utilisateur/);
  assert.match(source, /Retrouver des personnes de votre promotion 1957/);
  assert.match(source, /RESUME_WORK couvre les demandes de reprendre ou continuer/);
  const output = ai.validateHomeIntentOutput(JSON.stringify({ intent: "SEARCH_DIRECTORY", reformulation: "Retrouver des personnes de votre promotion 1957.", confidenceBand: "HIGH", proposedParameters: { query: "anciens de ma promo 1957" } }), "Chercher les anciens de ma promo 1957");
  assert.equal(output.intent, "SEARCH_DIRECTORY");
  assert.doesNotMatch(output.reformulation, /même formation/i);
  assert.throws(() => ai.validateHomeIntentOutput(JSON.stringify({ intent: "SEARCH_DIRECTORY", reformulation: "Rechercher les personnes ayant suivi la même formation que vous en 1957", confidenceBand: "HIGH", proposedParameters: { query: "anciens de ma promo 1957" } }), "Chercher les anciens de ma promo 1957"), /AI_OUTPUT_INVALID/);
});

test("ambiguous and unknown outcomes do not make an arbitrary choice", () => {
  const ambiguous = ai.validateHomeIntentOutput(parsed("AMBIGUOUS", {}, { ambiguityOptions: ["SEARCH_DIRECTORY", "CREATE_OPPORTUNITY"] }), "Trouver des experts et travailler avec eux");
  assert.deepEqual(ambiguous.ambiguityOptions, ["SEARCH_DIRECTORY", "CREATE_OPPORTUNITY"]);
  assert.equal(ai.validateHomeIntentOutput(parsed("UNKNOWN"), "Demande inconnue").intent, "UNKNOWN");
  assert.throws(() => ai.validateHomeIntentOutput(parsed("AMBIGUOUS", {}, { ambiguityOptions: ["SEARCH_DIRECTORY"] }), "Trouver des experts"), /AI_OUTPUT_INVALID/);
});

test("invalid intent, URL, invented object id, permissions and command are rejected", () => {
  for (const output of [
    parsed("DELETE_EVERYTHING"),
    parsed("CREATE_SIMPLE_LINK", { need: "Créer un lien", url: "/links/simple" }),
    parsed("OPEN_EXISTING_OBJECT", { objectQuery: "comité voyages", objectId: "invented" }),
    parsed("OPEN_MY_SPACES", {}, { permission: "ADMIN" }),
    parsed("OPEN_MY_SPACES", {}, { href: "https://attacker.test" }),
    JSON.stringify({ intent: "UNKNOWN", reformulation: "Run rm -rf files", confidenceBand: "HIGH", proposedParameters: {} }),
  ]) assert.throws(() => ai.validateHomeIntentOutput(output, "Demande utilisateur"), /AI_OUTPUT_INVALID/);
});

test("business reformulation does not inject Goodissima but may reflect an explicit product request", () => {
  assert.throws(() => ai.validateHomeIntentOutput(JSON.stringify({ intent: "CREATE_GOVERNED_JOURNEY", reformulation: "Créer un comité selon Goodissima", confidenceBand: "HIGH", proposedParameters: { need: "Comité de voyage" } }), "Créer un comité de voyage"), /AI_OUTPUT_INVALID/);
  assert.match(ai.validateHomeIntentOutput(JSON.stringify({ intent: "CREATE_OPPORTUNITY", reformulation: "Évaluer Goodissima", confidenceBand: "HIGH", proposedParameters: { need: "Évaluer Goodissima" } }), "Évaluer Goodissima").reformulation, /Goodissima/);
});

test("home AI uses a minimized classified capability, policy/router and no private object context", async () => {
  const prepared = ai.prepareHomeIntentText("Chercher jean@example.test avec token=abc123");
  assert.equal(prepared.classification, "CONFIDENTIAL");
  assert.doesNotMatch(prepared.text, /jean@example|abc123/);
  const result = await ai.interpretHomeIntent("Trouver des contacts en Bretagne", "user-1");
  assert.equal(result.interpretation.intent, "SEARCH_DIRECTORY");
  assert.equal(result.provenance.capability, "interpretHomeIntent");
  const source = read("lib/ai/governance/interpret-home-intent.ts");
  assert.match(source, /context: \{ type: "HOME_INTENT", data: \{\} \}/);
  assert.match(source, /await routeAI\(/);
  assert.doesNotMatch(source, /getConfiguredAIProvider|MISTRAL_API_KEY|prisma\./);
});

test("UI examples and explicit resume variants resolve before a failing provider", async () => {
  let calls = 0;
  const offline = loadTestModule<any>("lib/ai/governance/interpret-home-intent.ts", {
    "./router.ts": { routeAI: async () => { calls++; throw Error("PROVIDER_UNAVAILABLE"); } },
    "./types.ts": { AIGovernanceError: GovernanceError },
    "../../home-intent.ts": { HOME_INTENTS: ["RESUME_WORK", "CREATE_GOVERNED_JOURNEY", "CREATE_SIMPLE_LINK", "CREATE_OPPORTUNITY", "SEARCH_DIRECTORY", "OPEN_MY_SPACES", "OPEN_EXISTING_OBJECT", "UNKNOWN", "AMBIGUOUS"] },
  });
  for (const text of ["Reprendre où j'en étais", "Reprendre où j’en étais", "Reprendre là où j'en étais", "Reprendre ma dernière activité", "Reprendre mon travail", "Continuer où j'en étais", "Continuer là où j'en étais", "Continuer mon travail"]) {
    const result = await offline.interpretHomeIntent(text, "user-1");
    assert.equal(result.interpretation.intent, "RESUME_WORK", text);
    assert.equal(result.interpretation.reformulation, text);
    assert.equal(homeIntentChoice(result.interpretation.intent).label, "Ouvrir Mes espaces");
    assert.equal(result.provenance, undefined);
  }
  const directory = await offline.interpretHomeIntent("Chercher les anciens de ma promo 1957", "user-1");
  assert.equal(directory.interpretation.intent, "SEARCH_DIRECTORY");
  assert.equal(directory.interpretation.proposedParameters.query, "Chercher les anciens de ma promo 1957");
  assert.doesNotMatch(directory.interpretation.reformulation, /même formation|même école|même établissement/i);
  assert.equal((await offline.interpretHomeIntent("Créer un comité de voyage", "user-1")).interpretation.intent, "CREATE_GOVERNED_JOURNEY");
  assert.equal((await offline.interpretHomeIntent("Créer un lien avec Paul", "user-1")).interpretation.intent, "CREATE_SIMPLE_LINK");
  const spaced = "  REPRENDRE   où  j’en étais ?  ";
  assert.equal((await offline.interpretHomeIntent(spaced, "user-1")).interpretation.reformulation, spaced);
  for (const text of ["Reprendre où j'en étais /gouvernance", "Créer un lien avec Paul pour une opportunité", "Je ne veux pas reprendre mon travail"]) assert.equal(offline.resolveCanonicalHomeIntent(text), null);
  for (const text of ["Reprendre où j'en étais", "Créer un comité de voyage", "Chercher les anciens de ma promo 1957"]) {
    const result = offline.resolveCanonicalHomeIntent(text);
    assert.ok(result);
    assert.deepEqual(Object.keys(result.proposedParameters).sort(), result.intent === "RESUME_WORK" ? [] : [result.intent === "SEARCH_DIRECTORY" ? "query" : "need"]);
    assert.equal("href" in result, false);
    assert.equal("objectId" in result, false);
    assert.equal("permission" in result, false);
  }
  assert.equal(calls, 0);
  await assert.rejects(offline.interpretHomeIntent("Je cherche des experts en cybersécurité pour travailler avec eux", "user-1"), /PROVIDER_UNAVAILABLE/);
  assert.equal(calls, 1);
  const ui = read("components/HomeIntentEntry.tsx");
  for (const example of ["Reprendre où j’en étais", "Créer un comité de voyage", "Chercher les anciens de ma promo 1957"]) assert.ok(ui.includes(example));
});

test("one-use prefill never puts the need in a URL and never starts business work", () => {
  const data = new Map<string, string>();
  const window = { sessionStorage: { setItem: (key: string, value: string) => data.set(key, value), getItem: (key: string) => data.get(key) ?? null, removeItem: (key: string) => data.delete(key) } };
  const prefill = loadTestModule<any>("lib/home-intent-prefill.ts", {}, { window });
  prefill.saveHomeIntentPrefill("CREATE_GOVERNED_JOURNEY", "Créer un comité de voyage");
  assert.equal(prefill.consumeHomeIntentPrefill("CREATE_GOVERNED_JOURNEY"), "Créer un comité de voyage");
  assert.equal(prefill.consumeHomeIntentPrefill("CREATE_GOVERNED_JOURNEY"), null);
  assert.match(read("app/(connected)/gouvernance/nouveau/GovernanceJourneyAssistant.tsx"), /consumeHomeIntentPrefill\("CREATE_GOVERNED_JOURNEY"\)/);
  assert.match(read("components/OpportunityDraftCreator.tsx"), /consumeHomeIntentPrefill\("CREATE_OPPORTUNITY"\)/);
  assert.match(read("app/(connected)/links/simple/simple-link-builder.tsx"), /consumeHomeIntentPrefill\("CREATE_SIMPLE_LINK"\)/);
  const ui = read("components/HomeIntentEntry.tsx");
  assert.match(ui, /onClick=\{\(\) => continueTo\(result\.action\)\}/);
  assert.match(ui, /saveHomeIntentPrefill\(action\.intent, text\)/);
  assert.doesNotMatch(ui, /governedJourney\.create|opportunity\.create|gLink\.create/);
});

test("Home keeps classic entries, error fallback and Boussole separate", () => {
  const home = read("components/DashboardHome.tsx");
  const ui = read("components/HomeIntentEntry.tsx");
  assert.ok(home.indexOf("<HomeIntentEntry />") < home.indexOf("open-boussole-from-dashboard"));
  assert.match(home, /Créer et organiser vos liens, opportunités, parcours et espaces de travail/);
  for (const route of ["/boussole/decouverte", "/annuaire", "/gouvernance"]) assert.ok(home.includes(route));
  assert.match(ui, /Je cherche le meilleur point de départ/);
  assert.match(ui, /Vous pouvez utiliser les accès ci-dessous/);
  assert.match(read("lib/boussole/registry.ts"), /"repères": 3/);
  assert.doesNotMatch(read("app/api/home/interpret/route.ts"), /governedMemoryFact\.create|governedMemoryDecision\.create|governedMemorySource\.create/);
});

test("existing-object navigation resolves only server-verified recent or favorite objects", async () => {
  let interpreted: any = { intent: "OPEN_EXISTING_OBJECT", reformulation: "Ouvrir le comité voyages", confidenceBand: "HIGH", proposedParameters: { objectQuery: "comité voyages" } };
  let favorites: any[] = [{ title: "Comité voyages", href: "/gouvernance/parcours/owned/pilotage" }];
  const route = loadTestModule<any>("app/api/home/interpret/route.ts", {
    "next/server": { NextResponse: { json: (value: unknown, options?: { status?: number }) => ({ body: value, status: options?.status ?? 200 }) } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner-1" }) },
    "@/lib/ai/governance/interpret-home-intent": { interpretHomeIntent: async (_text: string, actorId: string) => { assert.equal(actorId, "owner-1"); return { interpretation: interpreted, provenance: {} }; } },
    "@/lib/ai/governance/types": { AIGovernanceError: GovernanceError },
    "@/lib/dashboard-activity-repository": { getDashboardActivity: async (ownerId: string) => { assert.equal(ownerId, "owner-1"); return []; } },
    "@/lib/personal-favorites-repository": { readFavoritePage: async (ownerId: string) => { assert.equal(ownerId, "owner-1"); return { items: favorites }; } },
    "@/lib/home-intent": { homeIntentChoice, isSafeHomeDestination },
  });
  const request = () => new Request("https://local.test/api/home/interpret", { method: "POST", body: JSON.stringify({ text: "Ouvrir le comité voyages" }) });
  const one = await route.POST(request());
  assert.equal(one.body.kind, "PROPOSAL");
  assert.equal(one.body.action.href, "/gouvernance/parcours/owned/pilotage");
  favorites = [favorites[0], { title: "Comité voyages 2026", href: "/gouvernance/parcours/owned-2/pilotage" }, { title: "Sans rapport", href: "/cases/foreign" }];
  const many = await route.POST(request());
  assert.equal(many.body.kind, "CHOICES");
  assert.equal(many.body.choices.length, 2);
  favorites = [];
  const none = await route.POST(request());
  assert.equal(none.body.kind, "UNKNOWN");
  interpreted = { intent: "UNKNOWN", reformulation: "Incertain", confidenceBand: "LOW", proposedParameters: {} };
  assert.equal((await route.POST(request())).body.kind, "UNKNOWN");
});

test("policy denial cannot trigger an ungoverned fallback or block classic Home routes", async () => {
  let failure = "AI_POLICY_DENIED";
  const route = loadTestModule<any>("app/api/home/interpret/route.ts", {
    "next/server": { NextResponse: { json: (value: unknown, options?: { status?: number }) => ({ body: value, status: options?.status ?? 200 }) } },
    "@/lib/auth": { getCurrentPrismaUser: async () => ({ id: "owner-1" }) },
    "@/lib/ai/governance/interpret-home-intent": { interpretHomeIntent: async () => { throw new GovernanceError(failure); } },
    "@/lib/ai/governance/types": { AIGovernanceError: GovernanceError },
    "@/lib/dashboard-activity-repository": { getDashboardActivity: async () => { throw Error("SHOULD_NOT_READ"); } },
    "@/lib/personal-favorites-repository": { readFavoritePage: async () => { throw Error("SHOULD_NOT_READ"); } },
    "@/lib/home-intent": { homeIntentChoice, isSafeHomeDestination },
  });
  const request = () => new Request("https://local.test/api/home/interpret", { method: "POST", body: JSON.stringify({ text: "Créer un comité de voyage" }) });
  const denied = await route.POST(request());
  assert.equal(denied.status, 503);
  assert.match(denied.body.error, /accès ci-dessous/);
  failure = "AI_OUTPUT_INVALID";
  const invalid = await route.POST(request());
  assert.equal(invalid.status, 200);
  assert.equal(invalid.body.kind, "UNKNOWN");
  assert.doesNotMatch(read("components/HomeIntentEntry.tsx"), /proposeGovernedJourneyAction|generateTemplateDraft|mockAIProvider/);
});
