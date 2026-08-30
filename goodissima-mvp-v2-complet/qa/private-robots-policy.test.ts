import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nextConfig = readFileSync("next.config.mjs", "utf8");
const middleware = readFileSync("middleware.ts", "utf8");

const robotsValue = "noindex, nofollow, noarchive";

test("private and authentication surfaces receive the robots header centrally", () => {
  assert.match(nextConfig, /async headers\(\)/);
  assert.match(nextConfig, new RegExp(robotsValue));

  for (const source of [
    "/dashboard/:path*",
    "/cases/:path*",
    "/templates/:path*",
    "/gouvernance/:path*",
    "/opportunities/:path*",
    "/workspaces/:path*",
    "/login",
    "/signup",
  ]) {
    assert.ok(nextConfig.includes(`"${source}"`), `${source} must be covered`);
  }
});

test("middleware adds the robots header to private responses including redirects", () => {
  assert.match(middleware, /withPrivateRobotsHeader\(await updateSession\(request\)\)/);
  assert.match(middleware, /headers\.set\("X-Robots-Tag", PRIVATE_ROBOTS_VALUE\)/);
  assert.match(middleware, new RegExp(robotsValue));
});

test("the public landing page is not covered by the private header policy", () => {
  assert.ok(!nextConfig.includes('"/"'), "/ must remain indexable");
});

test("robots and sitemap are not introduced during the recrawl phase", () => {
  assert.throws(() => readFileSync("app/robots.ts", "utf8"));
  assert.throws(() => readFileSync("app/sitemap.ts", "utf8"));
});
