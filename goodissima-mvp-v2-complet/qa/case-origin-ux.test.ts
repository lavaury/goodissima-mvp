import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { relationCaseOriginLabel } from "../lib/case-origin.ts";

test("l’origine d’un Dossier reste distincte de l’identité", () => {
  assert.equal(relationCaseOriginLabel("Garde d’enfants le mercredi"), "Réponse à « Garde d’enfants le mercredi »");
  assert.equal(relationCaseOriginLabel("   "), "Via un lien partagé");
  assert.equal(relationCaseOriginLabel(null), "Via un lien partagé");
});

test("les collections Dossiers affichent l’origine sans identifiant technique", async () => {
  const files = await Promise.all([
    readFile("app/(connected)/cases/page.tsx", "utf8"),
    readFile("components/SpacesExistingAttachments.tsx", "utf8"),
    readFile("components/WorkspaceDetailView.tsx", "utf8"),
  ]);

  for (const source of files) assert.match(source, /relationCaseOriginLabel/);
  assert.doesNotMatch(files.join("\n"), /Réponse à.*(?:gLinkId|Opportunity ID|token)/i);
});
