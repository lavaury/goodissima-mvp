import assert from "node:assert/strict";
import test from "node:test";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { projectOpportunity, buildOpportunityRulesV1 } from "../lib/opportunities/opportunity-projection.ts";
import { readFileSync } from "node:fs";
import { loadTestModule } from "./helpers/load-test-module.ts";

const { PublicAutonomousOpportunity } = loadTestModule<any>("components/PublicAutonomousOpportunity.tsx", {
  "react/jsx-runtime": jsx,
  "@/components/PublicOpportunitySecureExchange": { PublicOpportunitySecureExchange: ({ gLinkId }: { gLinkId: string }) => jsx.jsx("button", { children: `secure:${gLinkId}` }) },
});

test("public autonomous opportunity renders structured non-empty criteria without journey vocabulary", () => {
  const projection = projectOpportunity({ templateId: null, rules: buildOpportunityRulesV1({}, { type: "NEED", criteria: { subject: "baby-sitter", locations: ["Beauvais"], availability: { days: ["TUESDAY", "THURSDAY"], timeFrom: "18:00", timeTo: "20:00" } } }) })!;
  const html = renderToStaticMarkup(jsx.jsx(PublicAutonomousOpportunity, { gLinkId: "opportunity", title: "Recherche de baby-sitter à Beauvais", description: "Besoin régulier", projection }));
  for (const text of ["Je recherche", "baby-sitter", "Beauvais", "Mardi, Jeudi", "18:00", "20:00", "Besoin régulier"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes("secure:opportunity"));
  for (const text of ["Parcours", "TemplateVersion", "KPI", "gouvernance"]) assert.ok(!html.includes(text), text);
});

test("public route keeps server status/expiry gate and bypasses legacy response UI only for autonomous projection", () => {
  const source = readFileSync(new URL("../app/l/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /link\.status !== "ACTIVE"/); assert.match(source, /link\.expiresAt.*Date\.now/);
  assert.match(source, /projectOpportunity\(link\)/); assert.match(source, /PublicAutonomousOpportunity/);
  assert.ok(source.indexOf("PublicAutonomousOpportunity") < source.indexOf("const relationTemplate ="));
});

test("owner diffusion exposes one canonical URL to copy, QR and native sharing only while active", () => {
  const source = readFileSync(new URL("../components/AutonomousOpportunityManager.tsx", import.meta.url), "utf8");
  assert.match(source, /active \? <div data-boussole-id="autonomous-opportunity-public-link"/);
  assert.match(source, /<CopyLinkButton value=\{publicUrl\}/); assert.match(source, /<QRCodeBox value=\{publicUrl\}/); assert.match(source, /navigator\.share/);
  assert.doesNotMatch(source, /matching|MatchingRun|MatchingResult/);
});

test("autonomous confirmations use the accessible Goodissima dialog and QR wording stays factual", () => {
  const manager = readFileSync(new URL("../components/AutonomousOpportunityManager.tsx", import.meta.url), "utf8");
  const qr = readFileSync(new URL("../components/QRCodeBox.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(manager, /window\.confirm|\bconfirm\s*\(/);
  for (const text of ["Publier cette opportunité ?", "Suspendre la publication ?", "Reprendre la publication ?", "Archiver cette opportunité ?", "aria-modal=\"true\"", "Escape", "requestAnimationFrame", "max-w-lg", "max-h-[calc(100dvh-1.5rem)]"]) assert.ok(manager.includes(text), text);
  assert.match(manager, /document\.activeElement === first/); assert.match(manager, /confirmationTrigger\.current\?\.focus/);
  assert.match(qr, /Partagez ce QR Code pour permettre d’ouvrir directement cette opportunité\./);
  assert.doesNotMatch(qr, /contact sécurisé|téléphone|mise en relation|candidature/);
});
