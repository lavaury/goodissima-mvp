import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPublicAppUrl,
  isEphemeralVercelHostname,
  validatePublicAppUrl,
} from "../lib/public-app-url.ts";

test("rejects ephemeral Vercel deployment hosts outside local environments", () => {
  assert.equal(isEphemeralVercelHostname("goodissima-g0vje4xnj-lavaurys-projects.vercel.app"), true);
  assert.throws(
    () => validatePublicAppUrl("https://goodissima-g0vje4xnj-lavaurys-projects.vercel.app", "staging"),
    /PUBLIC_APP_URL_EPHEMERAL_VERCEL_FORBIDDEN/,
  );
  assert.equal(validatePublicAppUrl("https://goodissima.vercel.app/", "production"), "https://goodissima.vercel.app");
});

test("rejects invalid and localhost canonical URLs outside local environments", () => {
  assert.throws(() => validatePublicAppUrl("goodissima.app", "production"), /PUBLIC_APP_URL_INVALID/);
  assert.throws(() => validatePublicAppUrl("ftp://goodissima.app", "production"), /INVALID_PROTOCOL/);
  assert.throws(() => validatePublicAppUrl("http://localhost:3000", "staging"), /LOCALHOST_FORBIDDEN/);
  assert.equal(validatePublicAppUrl("http://localhost:3000/", "test"), "http://localhost:3000");
});

test("builds normalized public links from the configured canonical base", () => {
  const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  const previousEnvironment = process.env.GOODISSIMA_ENV;
  process.env.NEXT_PUBLIC_APP_URL = "https://preview.goodissima.app/";
  process.env.GOODISSIMA_ENV = "staging";
  try {
    assert.equal(buildPublicAppUrl("/l/lien%20stable"), "https://preview.goodissima.app/l/lien%20stable");
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
    if (previousEnvironment === undefined) delete process.env.GOODISSIMA_ENV;
    else process.env.GOODISSIMA_ENV = previousEnvironment;
  }
});

test("public link producers do not use VERCEL_URL or request origins", () => {
  const helper = readFileSync(new URL("../lib/public-app-url.ts", import.meta.url), "utf8");
  const legacyBuilder = readFileSync(new URL("../app/links/new/NewLinkForm.tsx", import.meta.url), "utf8");
  const simpleApi = readFileSync(new URL("../app/api/links/simple/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(helper, /VERCEL_URL/);
  assert.doesNotMatch(legacyBuilder, /window\.location\.origin/);
  assert.match(legacyBuilder, /link\.publicUrl/);
  assert.match(simpleApi, /buildPublicAppUrl/);
});
