import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { installModules } from "@aihot/backend/modules";
import { SERVER_MODULES } from "@aihot/site/modules/server";
import { buildApp } from "../../../apps/api/src/app.ts";
import { config } from "@aihot/backend/config";
import { publicFixture, visibilityChange } from "./public-fixtures.ts";
import { makeDraft, proof } from "./fixtures.ts";
import { clonePublishedProduct, updateProductDraft } from "../catalog/versions.ts";
import { updateProductIdentity, addProductAlias } from "../catalog/identity.ts";
import { setProductMarket, setProductLanguageSupport, setProductCapability } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { createEvidence } from "../catalog/evidence.ts";
import { createCandidate } from "../changes/candidates.ts";
import { tag } from "../../../tests/setup.ts";

installModules(SERVER_MODULES);
const app = await buildApp();
const base = "/api/site/aifind/products";
const get = (slug: string) => app.inject({ url: `${base}/${slug}` });
const list = () => app.inject({ url: base + "?limit=100" });
const sitemap = () => app.inject({ url: "/sitemap-products.xml" });
after(async () => { await app.close(); await closeDb(); });

test("W01/W02 Draft-only and private Published products are 404 and absent from all public lists", async () => {
  const a = await makeDraft(), b = await publicFixture("private");
  for (const slug of [a.product.slug, b.product.slug]) {
    assert.equal((await get(slug)).statusCode, 404);
    assert.doesNotMatch((await list()).body, new RegExp(slug));
    assert.doesNotMatch((await sitemap()).body, new RegExp(slug));
  }
});
test("W03/W04/W05/W06/W08 unlisted is direct-readable noindex; directory and sitemap include listed only", async () => {
  const a = await publicFixture("listed"), b = await publicFixture("unlisted");
  assert.equal((await get(a.product.slug)).statusCode, 200);
  const hidden = await get(b.product.slug); assert.equal(hidden.statusCode, 200);
  assert.equal(hidden.headers["x-robots-tag"], "noindex,follow");
  const names = (await list()).json().products.map((p: { slug: string }) => p.slug);
  assert.ok(names.includes(a.product.slug)); assert.ok(!names.includes(b.product.slug));
  const map = await sitemap(); assert.equal(map.statusCode, 200);
  assert.match(map.body, new RegExp(`/products/${a.product.slug}<`));
  assert.doesNotMatch(map.body, new RegExp(b.product.slug));
  assert.match(map.body, new RegExp(a.published.version.publishedAt!));
});
test("W09/W10/W12 historical lookup resolves directly to the current canonical; private histories reveal nothing", async () => {
  const f = await publicFixture(); const a = f.product.slug, b = `public-middle-${tag()}`, c = `public-final-${tag()}`;
  for (const slug of [b, c]) await sql.begin(tx => updateProductIdentity(f.product.id, { slug, canonicalName: f.product.canonicalName }, tx));
  for (const old of [a,b]) assert.deepEqual((await get(old)).json(), { kind: "redirect", slug: c });
  const current = (await get(c)).json(); assert.equal(current.product.canonicalUrl, `${config.siteUrl}/products/${c}`);
  await visibilityChange(f.product.id, "private");
  for (const old of [a,b,c]) assert.equal((await get(old)).statusCode, 404);
});
test("W13/W14/W15 Draft summary, price, market, Japanese UI and capability edits leave the public DTO and sitemap unchanged", async () => {
  const f = await publicFixture("listed", async (f,p) => {
    const plan = await saveProductPlan(f.product.id, f.draft.version.id, { planKey: "pro", name: "Pro" });
    await saveProductPrice(f.product.id, f.draft.version.id, plan.id, { priceType: "fixed", currencyCode: "USD", amountMinor: 2000, billingPeriod: "month", ...p });
  });
  const before = (await get(f.product.slug)).json(); const beforeMap = (await sitemap()).body;
  const d = await clonePublishedProduct(f.product.id, "draft-actor"), p = await proof();
  await updateProductDraft(f.product.id, d.version.id, { summaryJa: "DRAFT SECRET 下書きの文章" });
  await setProductMarket(f.product.id, d.version.id, { marketCode: "JP", availabilityStatus: "unavailable", ...p });
  await setProductLanguageSupport(f.product.id, d.version.id, { languageCode: "ja", inputSupport: "none", outputSupport: "none", uiSupport: "full", ...p });
  await setProductCapability(f.product.id, d.version.id, { capabilityKey: "agent", supportLevel: "full", ...p });
  const plan = d.plans[0], price = plan.prices[0];
  await saveProductPrice(f.product.id, d.version.id, plan.id, { id: price.id, priceType: "fixed", currencyCode: "USD", amountMinor: 9999, billingPeriod: "month", ...p });
  assert.deepEqual((await get(f.product.slug)).json(), before); assert.equal((await sitemap()).body, beforeMap);
  const card = (await list()).json().products.find((p: { slug: string }) => p.slug === f.product.slug);
  assert.equal(card.summaryJa, "公開テスト用の文章作成ツールです。"); assert.doesNotMatch(JSON.stringify(card), /DRAFT SECRET|9999/);
});
test("W16/W17 public allowlist omits internal IDs, notes, aliases, unreferenced Evidence, Candidates and audit", async () => {
  const f = await publicFixture();
  await addProductAlias(f.product.id, { alias: "internal-alias-secret", aliasType: "common" });
  await createEvidence({ url: "https://synthetic.example/unreferenced", sourceKind: "other", retrievedAt: "2026-10-05T00:00:00Z", evidenceNote: "UNREFERENCED PRIVATE" });
  await createCandidate({ productId: f.product.id, baseVersionId: f.published.version.id, candidateType: "market", targetKey: "JP", proposedValue: { marketCode: "JP", availabilityStatus: "restricted", ...f.proof }, evidenceId: f.proof.evidenceId, sourceType: "manual", reason: "CANDIDATE PRIVATE" }, "audit-private-actor");
  const response = await get(f.product.slug); assert.equal(response.statusCode, 200);
  const forbidden = new Set(["id","productId","vendorId","productVersionId","planId","evidenceId","createdAt","updatedAt","createdBy","evidenceNote","contentHash","aliases","draft","candidates","audit"]);
  const inspect = (v: unknown) => { if (v && typeof v === "object") for (const [k, value] of Object.entries(v)) { assert.ok(!forbidden.has(k), k); inspect(value); } };
  inspect(response.json());
  assert.doesNotMatch(response.body, /internal-alias-secret|unreferenced|CANDIDATE PRIVATE|audit-private-actor|合成 fixture/);
  assert.equal(response.json().product.evidence.length, 1);
});
test("W23 lastVerifiedAt is the credible published fact time, never the identity edit time", async () => {
  const f = await publicFixture();
  await sql.begin(tx => updateProductIdentity(f.product.id, { slug: f.product.slug, canonicalName: "Identity edited now" }, tx));
  assert.equal((await get(f.product.slug)).json().product.lastVerifiedAt, "2026-10-05T01:00:00.000Z");
});
test("W31/W32 withdrawal and unlisting apply immediately to API, lists, sitemap and OG with no-store", async () => {
  const f = await publicFixture();
  for (const url of [base, base+'/'+f.product.slug, "/sitemap-products.xml", "/og/products/"+f.product.slug+".png"]) {
    const r = await app.inject({url}); assert.equal(r.statusCode, 200, r.body.slice(0,100)); assert.match(String(r.headers['cache-control']), /no-store/);
  }
  await visibilityChange(f.product.id, "unlisted");
  assert.equal((await get(f.product.slug)).statusCode, 200); assert.doesNotMatch((await list()).body, new RegExp(f.product.slug)); assert.doesNotMatch((await sitemap()).body,new RegExp(f.product.slug));
  await visibilityChange(f.product.id,"private");
  const gone = await get(f.product.slug); assert.equal(gone.statusCode,404); assert.match(String(gone.headers['cache-control']),/no-store/);
  assert.equal((await app.inject({url:"/og/products/"+f.product.slug+".png"})).statusCode,404);
});
test("W34/W35 sitemap index includes the fresh product map; maps omit admin, private and unlisted routes", async () => {
  const a = await publicFixture("private"), b = await publicFixture("unlisted");
  const r = await app.inject({url:"/sitemap-index.xml"}); assert.equal(r.statusCode,200); assert.match(r.body, /sitemap-products\.xml/); assert.match(r.body,/sitemap\.xml/);
  const robots = await app.inject({url:"/robots.txt"}); assert.match(robots.body,/Sitemap: .*\/sitemap-index\.xml/);
  for (const map of [await sitemap(),await app.inject({url:"/sitemap.xml"})]) assert.doesNotMatch(map.body,new RegExp(`admin|${a.product.slug}|${b.product.slug}`));
});
test("public visibility action retains session, CSRF and 422 validation boundaries", async () => {
  const f = await makeDraft(), path = `/api/admin/aifind/products/${f.product.id}/public-settings`;
  assert.equal((await app.inject({method:"PATCH",url:path,payload:{}})).statusCode,401);
  const previous = config.adminPassword; config.adminPassword="synthetic-public-admin";
  try {
    const login = await app.inject({method:"POST",url:"/api/auth/password",headers:{"content-type":"application/x-www-form-urlencoded"},payload:"password=synthetic-public-admin"});
    const cookie=String(login.headers['set-cookie']).split(';')[0];
    assert.equal((await app.inject({method:"PATCH",url:path,headers:{cookie},payload:{}})).statusCode,403);
    const csrf=(await app.inject({url:"/api/admin/me",headers:{cookie}})).json().csrf;
    const [row]=await sql`SELECT identity_revision FROM af_products WHERE id=${f.product.id}`;
    const r=await app.inject({method:"PATCH",url:path,headers:{cookie,"x-csrf-token":csrf},payload:{visibility:"listed",expectedRevision:row.identity_revision,reason:"Not ready"}});
    assert.equal(r.statusCode,422,r.body); assert.match(r.body,/Published/);
  } finally {config.adminPassword=previous;}
});
