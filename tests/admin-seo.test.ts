import "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb } from "@aihot/backend/db";
import { seoOverview } from "@aihot/backend/admin/seo";
import { searchVerification } from "@aihot/contracts/seo";
import { buildApp } from "../apps/api/src/app.ts";

after(closeDb);
test("verification metadata accepts only the two explicit public tokens, never arbitrary environment secrets", () => {
  assert.deepEqual(searchVerification({ GOOGLE_SITE_VERIFICATION: " google-123_ABC ", BING_SITE_VERIFICATION: "ABCDEF0123", OPENAI_API_KEY: "sk-test-secret" }), { google: "google-123_ABC", bing: "ABCDEF0123" });
  assert.deepEqual(searchVerification({ GOOGLE_SITE_VERIFICATION: '<meta name="injected">', BING_SITE_VERIFICATION: "sk-proj-not-a-verification-token" }), { google: null, bing: null });
});

test("SEO dashboard distinguishes a configured domain from preview and unverified external ownership", async () => {
  const old = { siteUrl: config.siteUrl, preview: process.env.SITE_PREVIEW, token: process.env.GOOGLE_SITE_VERIFICATION };
  try {
    config.siteUrl = "http://127.0.0.1:3100"; process.env.SITE_PREVIEW = "true";
    const preview = await seoOverview();
    assert.equal(preview.preview, true); assert.equal(preview.https, false); assert.equal(preview.publicOrigin, false);
    config.siteUrl = "https://news.example.jp"; process.env.SITE_PREVIEW = "false"; process.env.GOOGLE_SITE_VERIFICATION = "public-verification-token";
    const site = await seoOverview();
    assert.equal(site.publicOrigin, true); assert.equal(site.preview, false);
    assert.deepEqual(site.verification.google, { configured: true, verified: null });
    assert.equal(site.sitemap, "https://news.example.jp/sitemap.xml");
    assert.equal(JSON.stringify(site).includes("public-verification-token"), false);
  } finally {
    config.siteUrl = old.siteUrl;
    for (const [key, value] of [["SITE_PREVIEW", old.preview], ["GOOGLE_SITE_VERIFICATION", old.token]] as const) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("SEO diagnostics require admin auth and preview resources carry noindex", async () => {
  const old = { admin: config.devAdmin, preview: process.env.SITE_PREVIEW };
  process.env.SITE_PREVIEW = "true";
  const app = await buildApp();
  try {
    config.devAdmin = null;
    assert.equal((await app.inject({ url: "/api/admin/seo" })).statusCode, 401);
    config.devAdmin = { displayName: "SEO test" };
    const response = await app.inject({ url: "/api/admin/seo" });
    assert.equal(response.statusCode, 200); assert.equal(response.headers["cache-control"], "no-store");
    assert.match(String((await app.inject({ url: "/robots.txt" })).headers["x-robots-tag"]), /noindex/);
    assert.match(String((await app.inject({ url: "/api/v1/items" })).headers["x-robots-tag"]), /noindex/);
  } finally {
    await app.close(); config.devAdmin = old.admin;
    if (old.preview === undefined) delete process.env.SITE_PREVIEW; else process.env.SITE_PREVIEW = old.preview;
  }
});
