import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb, sql } from "@aihot/backend/db";
import { installModules } from "@aihot/backend/modules";
import { SERVER_MODULES } from "@aihot/site/modules/server";
import { buildApp } from "../../../apps/api/src/app.ts";
import { createProduct, createVendor } from "../catalog/identity.ts";
import { createProductDraft, updateProductDraft } from "../catalog/versions.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { assertPreviewWrites } from "../preview/config.ts";
import { PREVIEW_SLUG, seedPreviewProduct } from "../preview/seed.ts";
import type { ProductDomainPreview } from "../preview/contracts.ts";

installModules(SERVER_MODULES);
const app = await buildApp();
const original = { password: config.adminPassword, admin: config.devAdmin };
config.devAdmin = null;
config.adminPassword = "aifind-preview-test-password";
const login = await app.inject({ method: "POST", url: "/api/auth/password",
  headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "password=aifind-preview-test-password" });
assert.equal(login.statusCode, 303);
const cookie = String(login.headers["set-cookie"]).split(";")[0];
const me = (await app.inject({ url: "/api/admin/me", headers: { cookie } })).json();
const endpoint = "/api/admin/aifind/preview/product-domain";
after(async () => { config.adminPassword = original.password; config.devAdmin = original.admin; await app.close(); await closeDb(); });

test("Preview startup and default flag create no products; disabled reads and writes remain inaccessible", async () => {
  delete process.env.AIFIND_PREVIEW_ENABLED;
  assert.equal(Number((await sql`SELECT count(*) AS n FROM af_products`)[0].n), 0);
  assert.equal((await app.inject({ url: endpoint, headers: { cookie } })).statusCode, 404);
  await assert.rejects(seedPreviewProduct(), /AIFIND_PREVIEW_ENABLED/);
  assert.equal(Number((await sql`SELECT count(*) AS n FROM af_products`)[0].n), 0);
});

test("Preview seeds refuse production, nonlocal hosts and ordinary databases, even with the flag enabled", async () => {
  const safe = { AIFIND_PREVIEW_ENABLED: "true", NODE_ENV: "development", AIHOT_ENVIRONMENT: "development",
    DATABASE_URL: "postgres://127.0.0.1:55432/aifind_preview" };
  for (const change of [{ NODE_ENV: "production" }, { AIHOT_ENVIRONMENT: "production" },
    { DATABASE_URL: "postgres://remote.example/aifind_preview" }, { DATABASE_URL: "postgres://127.0.0.1/aisignal_launch" },
    { DATABASE_URL: "postgres://127.0.0.1:55432/safe_preview?database=aisignal_launch" },
    { DATABASE_URL: "postgres://127.0.0.1:55432/safe_preview?host=remote.example" },
    { DATABASE_URL: "postgres://127.0.0.1:55432/safe_preview?options=-c%20search_path%3Dother" }]) {
    assert.throws(() => assertPreviewWrites({ ...safe, ...change }), /Preview/);
  }
  process.env.AIFIND_PREVIEW_ENABLED = "true";
  const old = process.env.NODE_ENV;
  try { process.env.NODE_ENV = "production"; await assert.rejects(seedPreviewProduct(), /production/); }
  finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
  assert.equal(Number((await sql`SELECT count(*) AS n FROM af_products`)[0].n), 0);
});

test("Preview API rejects anonymous reads, single-fetch-equivalent reads and demo writes; authenticated writes need CSRF", async () => {
  process.env.AIFIND_PREVIEW_ENABLED = "true";
  for (const request of [{ url: endpoint }, { url: endpoint + "?_routes=preview" }, { url: endpoint + "/draft-demo", method: "POST" as const }]) {
    const r = await app.inject(request);
    assert.equal(r.statusCode, 401);
    assert.match(String(r.headers["x-robots-tag"]), /noindex/);
    assert.match(String(r.headers["cache-control"]), /no-store/);
    assert.doesNotMatch(r.body, /displayName|createdBy/);
  }
  assert.equal((await app.inject({ url: endpoint + "/draft-demo", method: "POST", headers: { cookie } })).statusCode, 403);
});

test("Preview reads real published/draft Domain data and fact verification times without seeding on reads", async () => {
  const empty = await app.inject({ url: endpoint, headers: { cookie } });
  assert.deepEqual([empty.json().published, empty.json().draft], [null, null]);
  assert.equal(Number((await sql`SELECT count(*) AS n FROM af_products`)[0].n), 0);
  await seedPreviewProduct();
  const r = await app.inject({ url: endpoint, headers: { cookie } });
  assert.equal(r.statusCode, 200);
  const { published, draft } = r.json<ProductDomainPreview>();
  assert.ok(published);
  assert.ok(draft);
  const expected = await getPublishedProductBySlug(PREVIEW_SLUG);
  assert.ok(expected);
  assert.deepEqual(published, expected);
  assert.equal(published.version.versionNo, 1);
  assert.equal(draft.version.versionNo, 2);
  assert.equal(published.version.status, "published");
  assert.equal(draft.version.status, "draft");
  assert.equal(published.lastVerifiedAt, "2026-10-06T00:00:00.000Z");
  assert.equal(draft.lastVerifiedAt, "2026-10-06T02:00:00.000Z");
  assert.notEqual(published.lastVerifiedAt, published.identity.updatedAt);
  assert.equal(published.markets.find((m: { marketCode: string }) => m.marketCode === "JP")?.availabilityStatus, "available");
  assert.equal(published.evidence.some((e: { url: string }) => e.url.includes("draft-only")), false);
  assert.equal(draft.evidence.some((e: { url: string }) => e.url.includes("draft-only")), true);
});

test("Draft demo changes only the marked sample, keeps Published identical and repeat seeding preserves edits", async () => {
  const vendor = await createVendor({ slug: "other-preview-test-vendor", name: "Other vendor" });
  const other = await createProduct({ slug: "other-preview-test-product", canonicalName: "Other product", vendorId: vendor.id });
  await createProductDraft(other.id, { displayName: "Other draft" });
  const before = (await app.inject({ url: endpoint, headers: { cookie } })).json();
  const changed = await app.inject({ method: "POST", url: endpoint + "/draft-demo", headers: { cookie, "x-csrf-token": me.csrf }, payload: {} });
  assert.equal(changed.statusCode, 200);
  const afterChange = (await app.inject({ url: endpoint, headers: { cookie } })).json();
  assert.notEqual(afterChange.draft.version.displayName, before.draft.version.displayName);
  assert.deepEqual(afterChange.published, before.published);
  assert.equal((await sql`SELECT display_name FROM af_product_versions WHERE product_id=${other.id}`)[0].display_name, "Other draft");
  await updateProductDraft(afterChange.published.identity.id, afterChange.draft.version.id, { displayName: "[PREVIEW] Independent domain edit" });
  await seedPreviewProduct();
  assert.equal((await app.inject({ url: endpoint, headers: { cookie } })).json().draft.version.displayName, "[PREVIEW] Independent domain edit");
  const old = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.equal((await app.inject({ url: endpoint, headers: { cookie } })).json().canMutateDemo, false);
    assert.equal((await app.inject({ method: "POST", url: endpoint + "/draft-demo", headers: { cookie, "x-csrf-token": me.csrf }, payload: {} })).statusCode, 403);
  } finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
});

test("Preview stays outside sitemap, public API, RSS and MCP routing", async () => {
  for (const url of ["/sitemap.xml", "/feed.xml", "/api/v1/items", "/llms.txt"]) {
    const r = await app.inject({ url });
    assert.equal(r.statusCode, 200, url);
    assert.doesNotMatch(r.body, /admin\/aifind\/preview|\[PREVIEW\]|aifind-preview-product-domain|draft-only/);
  }
  assert.equal((await app.inject({ url: "/api/v1/aifind/preview/product-domain" })).statusCode, 404);
  const r = await app.inject({ method: "POST", url: "/api/mcp", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    payload: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /tools/);
  assert.doesNotMatch(r.body, /aifind.*preview|draft-only/);
});
