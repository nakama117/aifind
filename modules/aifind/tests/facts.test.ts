import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { getDraftProduct, clonePublishedProduct } from "../catalog/versions.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { makeDraft, proof, markPublished } from "./fixtures.ts";

after(closeDb);
async function domain() {
  assert.ok(existsSync(new URL("../catalog/facts.ts", import.meta.url)), "structured product facts must exist");
  return import("../catalog/facts.ts");
}

test("P08 unknown and unavailable markets remain distinct", async () => {
  const { setProductMarket } = await domain();
  const { product: p, draft: v } = await makeDraft();
  await setProductMarket(p.id, v.version.id, { marketCode: "JP", availabilityStatus: "unknown" });
  await setProductMarket(p.id, v.version.id, { marketCode: "US", availabilityStatus: "unavailable", ...await proof() });
  const row = await getDraftProduct(p.id);
  assert.equal(row?.markets.find(m => m.marketCode === "JP")?.availabilityStatus, "unknown");
  assert.equal(row?.markets.find(m => m.marketCode === "US")?.availabilityStatus, "unavailable");
});

test("P09 Japanese input, output and UI support are independent", async () => {
  const { setProductLanguageSupport } = await domain();
  const { product: p, draft: v } = await makeDraft();
  await setProductLanguageSupport(p.id, v.version.id, { languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "none", ...await proof() });
  await markPublished(v.version.id);
  const ja = (await getPublishedProductBySlug(p.slug))!.languages.find(l => l.languageCode === "ja")!;
  assert.deepEqual([ja.inputSupport, ja.outputSupport, ja.uiSupport], ["full", "full", "none"]);
});

test("P10 a missing Android record projects unknown rather than unavailable", async () => {
  await domain();
  const { product: p, draft: v } = await makeDraft();
  await markPublished(v.version.id);
  const android = (await getPublishedProductBySlug(p.slug))!.platforms.find(f => f.platformKey === "android")!;
  assert.equal(android.status, "unknown");
  assert.equal(android.evidenceId, null);
  assert.equal(android.verifiedAt, null);
});

test("market, language and platform keys are controlled in domain and database", async () => {
  const { setProductMarket, setProductLanguageSupport, setProductPlatform } = await domain();
  const { product: p, draft: v } = await makeDraft();
  await assert.rejects(setProductMarket(p.id, v.version.id, { marketCode: "garbage", availabilityStatus: "unknown" }));
  await assert.rejects(setProductLanguageSupport(p.id, v.version.id, { languageCode: "garbage", inputSupport: "full", outputSupport: "full", uiSupport: "none" }));
  await assert.rejects(setProductPlatform(p.id, v.version.id, { platformKey: "arbitrary", status: "unknown" }));
  await assert.rejects(sql`INSERT INTO af_product_platforms(product_version_id, platform_key) VALUES (${v.version.id}, 'arbitrary')`, { code: "23514" });
});

test("version-scoped market, language and platform edits cannot mutate the published facts", async () => {
  const { setProductMarket, setProductLanguageSupport, setProductPlatform } = await domain();
  const { product: p, draft: v } = await makeDraft();
  const verified = await proof();
  await setProductMarket(p.id, v.version.id, { marketCode: "JP", availabilityStatus: "available", ...verified });
  await setProductLanguageSupport(p.id, v.version.id, { languageCode: "ja", inputSupport: "full", outputSupport: "partial", uiSupport: "none", ...verified });
  await setProductPlatform(p.id, v.version.id, { platformKey: "web", status: "available", ...verified });
  await markPublished(v.version.id);
  const published = await getPublishedProductBySlug(p.slug);
  const clone = await clonePublishedProduct(p.id);
  assert.notEqual(clone.markets[0].id, published!.markets[0].id);
  await setProductMarket(p.id, clone.version.id, { marketCode: "JP", availabilityStatus: "unknown" });
  await setProductLanguageSupport(p.id, clone.version.id, { languageCode: "ja", inputSupport: "none", outputSupport: "none", uiSupport: "none" });
  await setProductPlatform(p.id, clone.version.id, { platformKey: "web", status: "unavailable" });
  assert.deepEqual(await getPublishedProductBySlug(p.slug), published);
  await assert.rejects(sql`UPDATE af_product_markets SET availability_status='unavailable' WHERE product_version_id=${v.version.id}`, /immutable/);
  await assert.rejects(sql`INSERT INTO af_product_platforms(product_version_id, platform_key) VALUES (${v.version.id}, 'android')`, /immutable/);
});

test("facts reject cross-product version ownership and missing evidence references", async () => {
  const { setProductMarket } = await domain();
  const a = await makeDraft(); const b = await makeDraft();
  await assert.rejects(setProductMarket(a.product.id, b.draft.version.id, { marketCode: "JP", availabilityStatus: "available" }), /belong/);
  await assert.rejects(setProductMarket(a.product.id, a.draft.version.id, { marketCode: "JP", availabilityStatus: "available", evidenceId: "missing" }), { code: "23503" });
});

test("P11 unknown capability and explicitly unsupported capability remain distinct", async () => {
  const facts = await domain();
  assert.equal(typeof facts.setProductCapability, "function", "controlled capability writer must exist");
  const { product: p, draft: v } = await makeDraft();
  await facts.setProductCapability(p.id, v.version.id, { capabilityKey: "text", supportLevel: "unknown" });
  await facts.setProductCapability(p.id, v.version.id, { capabilityKey: "coding", supportLevel: "none", ...await proof() });
  await markPublished(v.version.id);
  const row = await getPublishedProductBySlug(p.slug);
  assert.equal(row?.capabilities.find(c => c.capabilityKey === "text")?.supportLevel, "unknown");
  assert.equal(row?.capabilities.find(c => c.capabilityKey === "coding")?.supportLevel, "none");
});

test("P12 an arbitrary capability key is rejected by domain and database", async () => {
  const facts = await domain();
  assert.equal(typeof facts.setProductCapability, "function", "controlled capability writer must exist");
  const { product: p, draft: v } = await makeDraft();
  await assert.rejects(facts.setProductCapability(p.id, v.version.id, { capabilityKey: "uncontrolled", supportLevel: "full" }));
  await assert.rejects(sql`INSERT INTO af_product_capabilities(product_version_id, capability_key) VALUES (${v.version.id}, 'uncontrolled')`, { code: "23514" });
});
