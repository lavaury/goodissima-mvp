import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeneratedSecureLink,
  buildSecureLinkListingPreview,
  secureLinkGenerationState,
} from "../lib/secure-link-preview.ts";

const verifiedTemplate = {
  id: "template-housing",
  name: "Location certifiée",
  status: "PUBLISHED",
  photos: ["https://example.test/appartement.jpg"],
  attachments: ["Diagnostic énergétique.pdf"],
  verifiedLinks: ["https://example.test/visite"],
  verificationRequired: true,
};

test("builds the French announcement preview from form and template data", () => {
  const preview = buildSecureLinkListingPreview({
    title: "Appartement lumineux",
    city: "Lyon",
    description: "Deux pièces proche des transports.",
    template: verifiedTemplate,
  });

  assert.equal(preview.title, "Appartement lumineux");
  assert.equal(preview.city, "Lyon");
  assert.equal(preview.description, "Deux pièces proche des transports.");
  assert.equal(preview.journeyName, "Location certifiée");
  assert.deepEqual(preview.photos, verifiedTemplate.photos);
  assert.deepEqual(preview.attachments, verifiedTemplate.attachments);
  assert.deepEqual(preview.verifiedLinks, verifiedTemplate.verifiedLinks);
});

test("reflects field updates without persisting or publishing anything", () => {
  const first = buildSecureLinkListingPreview({ title: "Studio", city: "Paris", description: "Calme", template: verifiedTemplate });
  const updated = buildSecureLinkListingPreview({ title: "Studio rénové", city: "Nantes", description: "Calme et rénové", template: verifiedTemplate });

  assert.equal(first.title, "Studio");
  assert.equal(updated.title, "Studio rénové");
  assert.equal(updated.city, "Nantes");
  assert.equal(updated.description, "Calme et rénové");
});

test("exposes verified and unverified trust badges", () => {
  const verified = buildSecureLinkListingPreview({ title: "Offre", city: "Lille", description: "Description", template: verifiedTemplate });
  assert.deepEqual(verified.badges, ["Brouillon", "Lien sécurisé", "Vérification requise", "Photo vérifiée", "Lien vérifié"]);

  const unverified = buildSecureLinkListingPreview({
    title: "Offre",
    city: "Lille",
    description: "Description",
    template: { ...verifiedTemplate, photos: [], verifiedLinks: [], verificationRequired: false },
  });
  assert.ok(unverified.badges.includes("Photo non vérifiée"));
  assert.ok(unverified.badges.includes("Lien externe non vérifié"));
});

test("moves to generated state only when a secure-link URL exists", () => {
  assert.equal(secureLinkGenerationState(null), "DRAFT");
  const url = buildGeneratedSecureLink("https://goodissima.test/", "lien démo");
  assert.equal(url, "https://goodissima.test/l/lien%20d%C3%A9mo");
  assert.equal(secureLinkGenerationState(url), "GENERATED");
});
