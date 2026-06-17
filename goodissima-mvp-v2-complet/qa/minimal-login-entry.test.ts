import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("uses the shared authentication entry on the public homepage and login route", () => {
  const home = source("app/page.tsx");
  const login = source("app/login/page.tsx");

  assert.match(home, /LoginEntry/);
  assert.match(login, /LoginEntry/);
  assert.doesNotMatch(home, /opportunities\/new|dashboard|homepage\.cta|homepage\.step/i);
});

test("shows only the required French-first login actions", () => {
  const entry = source("components/LoginEntry.tsx");

  for (const text of [
    "Connexion",
    "Email",
    "Mot de passe",
    "Se connecter",
    "Mot de passe oublié ?",
    "Pas encore de compte ?",
    "Créer un accès",
  ]) {
    assert.match(entry, new RegExp(text.replace(/[?]/g, "\\?")));
  }

  assert.match(entry, /logo-goodissima\.png/);
  assert.match(entry, /href="\/reset-password"/);
  assert.match(entry, /href=\{`\/signup\?next=/);
});

test("keeps the existing authentication and access checks", () => {
  const entry = source("components/LoginEntry.tsx");

  assert.match(entry, /\/api\/access-invitations\/check/);
  assert.match(entry, /signInWithPassword/);
  assert.match(entry, /router\.replace\(next\)/);
  assert.match(entry, /nextParam\?\.startsWith\("\/"\)/);
});

test("contains no public marketing or product discovery copy", () => {
  const entry = source("components/LoginEntry.tsx");

  assert.doesNotMatch(entry, /opportunit|matching|intelligence artificielle|\bIA\b|créer une annonce/i);
  assert.doesNotMatch(entry, /href=.*dashboard|>[^<]*dashboard[^<]*</i);
  assert.doesNotMatch(entry, /description du produit|découvrir|en savoir plus/i);
});

test("keeps global utility controls off the root entry", () => {
  assert.match(source("components/FeedbackButton.tsx"), /pathname === "\/"/);
  assert.match(source("components/GlobalLanguageSwitcher.tsx"), /pathname === "\/"/);
});

test("keeps discovery content available outside the homepage", () => {
  assert.match(source("app/experience/page.tsx"), /GoodissimaExperienceJourney/);
});
