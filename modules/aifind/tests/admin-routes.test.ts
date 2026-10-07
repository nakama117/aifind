import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { config } from "@aihot/backend/config";
import { closeDb } from "@aihot/backend/db";
import { installModules } from "@aihot/backend/modules";
import { SERVER_MODULES } from "@aihot/site/modules/server";
import { buildApp } from "../../../apps/api/src/app.ts";
import { publishedFixture, reason, slug } from "./admin-fixtures.ts";
import { createAdminDraft } from "../admin/products.ts";
import { readAdminProduct } from "../admin/read.ts";
import { createCandidate, reviewCandidate } from "../changes/candidates.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";

installModules(SERVER_MODULES);
const app = await buildApp();
const old = { password: config.adminPassword, admin: config.devAdmin };
config.devAdmin = null; config.adminPassword = "synthetic-aifind-admin-password";
const login = await app.inject({ method: "POST", url: "/api/auth/password", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: "password=synthetic-aifind-admin-password" });
assert.equal(login.statusCode, 303);
const cookie = String(login.headers["set-cookie"]).split(";")[0];
const csrf = (await app.inject({ url: "/api/admin/me", headers: { cookie } })).json().csrf;
const headers = { cookie, "x-csrf-token": csrf };
const prefix = "/api/admin/aifind";
after(async () => { config.adminPassword = old.password; config.devAdmin = old.admin; await app.close(); await closeDb(); });

test("A01/A02/A23 anonymous Product and Review reads/writes expose no Draft; every mutation requires CSRF", async () => {
  const requests = [
    ["GET", "/dashboard"], ["GET", "/products"], ["POST", "/products"], ["GET", "/products/missing"],
    ["PATCH", "/products/missing/identity"], ["POST", "/products/missing/aliases"], ["POST", "/products/missing/draft"],
    ["PATCH", "/products/missing/draft/missing"], ["POST", "/products/missing/draft/missing/publish"],
    ["GET", "/vendors"], ["POST", "/vendors"], ["PATCH", "/vendors/missing"], ["GET", "/evidence"], ["POST", "/evidence"],
    ["GET", "/candidates"], ["POST", "/candidates"], ["GET", "/candidates/missing"],
    ["POST", "/candidates/missing/approve"], ["POST", "/candidates/missing/reject"], ["POST", "/candidates/missing/apply"],
  ] as const;
  for (const [method, path] of requests) {
    const r = await app.inject({ method, url: prefix + path, ...(method !== "GET" ? { payload: {} } : {}) });
    assert.equal(r.statusCode, 401, path);
    assert.match(String(r.headers["x-robots-tag"]), /noindex/);
    assert.match(String(r.headers["cache-control"]), /no-store/);
    assert.doesNotMatch(r.body, /createdBy|displayName|proposedValue/);
    if (method !== "GET") assert.equal((await app.inject({ method, url: prefix + path, headers: { cookie }, payload: {} })).statusCode, 403, path);
  }
});

test("A03/A04 authenticated API reads Catalog data and writes with the real session/CSRF actor", async () => {
  const r = await app.inject({ method: "POST", url: prefix + "/products", headers, payload: { slug: slug(), canonicalName: "[TEST] API Product", reason } });
  assert.equal(r.statusCode, 200, r.body);
  const identity = r.json();
  const created = await app.inject({ method: "POST", url: `${prefix}/products/${identity.id}/draft`, headers, payload: { reason } });
  assert.equal(created.statusCode, 200, created.body);
  const detail = await app.inject({ url: `${prefix}/products/${identity.id}`, headers });
  assert.equal(detail.statusCode, 200);
  assert.deepEqual(detail.json(), await readAdminProduct(identity.id));
  const list = await app.inject({ url: prefix + "/products?q=API%20Product&filter=draft", headers });
  assert.equal(list.json().rows.some((p: { id: string }) => p.id === identity.id), true);
  assert.match(String(list.headers["cache-control"]), /no-store/);
  assert.match(String(list.headers["x-robots-tag"]), /noindex/);
});

test("A07/A08 HTTP distinguishes invalid, absent, stale and per-field publication validation", async () => {
  assert.equal((await app.inject({ url: prefix + "/products/missing", headers })).statusCode, 404);
  assert.equal((await app.inject({ url: prefix + "/candidates/missing", headers })).statusCode, 404);
  assert.equal((await app.inject({ url: prefix + "/products?filter=invalid", headers })).statusCode, 400);
  assert.equal((await app.inject({ method: "POST", url: prefix + "/evidence", headers, payload: { url: "file:///secret", reason } })).statusCode, 400);
  const vendor = (await app.inject({ method: "POST", url: prefix + "/vendors", headers, payload: { slug: slug(), name: "[TEST] API Vendor", reason } })).json();
  const emptyPatch = await app.inject({ method: "PATCH", url: `${prefix}/vendors/${vendor.id}`, headers, payload: { expectedUpdatedAt: vendor.updatedAt, reason } });
  assert.equal(emptyPatch.statusCode, 400, "empty Vendor patch must be an invalid input, never a server error");
  const f = await publishedFixture(); const d = await createAdminDraft(f.product.id, { reason }, "synthetic-editor");
  const endpoint = `${prefix}/products/${f.product.id}/draft/${d.draft.version.id}`;
  const body = { expectedRevision: d.revision, languages: [{ languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "full", evidenceId: null, verifiedAt: null }], reason };
  const save = await app.inject({ method: "PATCH", url: endpoint, headers, payload: body });
  assert.equal(save.statusCode, 200, save.body);
  const stale = await app.inject({ method: "PATCH", url: endpoint, headers, payload: body });
  assert.equal(stale.statusCode, 409);
  assert.match(stale.json().detail, /この下書きは別の操作で更新されています/);
  const publish = await app.inject({ method: "POST", url: endpoint + "/publish", headers, payload: { expectedRevision: save.json().revision, reason } });
  assert.equal(publish.statusCode, 422, publish.body);
  assert.match(publish.json().detail, /language:ja:ui/);
  assert.deepEqual(await getPublishedProductBySlug(f.product.slug), f.published);
});

test("A20 HTTP stale Candidate base returns 409, never publishes or changes a Draft", async () => {
  const f = await publishedFixture();
  const c = await createCandidate({ productId: f.product.id, baseVersionId: f.published.version.id, candidateType: "market", targetKey: "JP",
    proposedValue: { marketCode: "JP", availabilityStatus: "available", ...f.proof }, evidenceId: f.proof.evidenceId, sourceType: "manual", reason }, "synthetic-editor");
  await reviewCandidate(c.id, "approve", { reason }, "synthetic-editor");
  const d = await createAdminDraft(f.product.id, { reason }, "synthetic-editor");
  await publishProductVersion(f.product.id, d.draft.version.id, "synthetic-editor", reason);
  const before = await readAdminProduct(f.product.id);
  const r = await app.inject({ method: "POST", url: `${prefix}/candidates/${c.id}/apply`, headers, payload: { reason } });
  assert.equal(r.statusCode, 409, r.body);
  assert.match(r.json().detail, /基準 Published/);
  assert.deepEqual(await readAdminProduct(f.product.id), before);
});

test("A24 Product Admin and Review Queue never register a public products endpoint or sitemap/RSS/MCP output", async () => {
  for (const url of ["/sitemap.xml", "/feed.xml", "/api/v1/items", "/llms.txt"]) {
    const r = await app.inject({ url }); assert.equal(r.statusCode, 200);
    assert.doesNotMatch(r.body, /admin\/aifind|\[TEST\] API Product|proposedValue|draftRevision/);
  }
  for (const url of ["/api/v1/products", "/api/v1/aifind/products", "/api/v1/aifind/candidates"])
    assert.equal((await app.inject({ url })).statusCode, 404);
  const r = await app.inject({ method: "POST", url: "/api/mcp", headers: { accept: "application/json, text/event-stream" }, payload: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
  assert.equal(r.statusCode, 200); assert.doesNotMatch(r.body, /aifind|proposedValue|draftRevision/);
});
