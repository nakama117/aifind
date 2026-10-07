import "../../../tests/setup.ts";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { closeDb, sql } from "@aihot/backend/db";
import { addProductAlias } from "../catalog/identity.ts";
import { clonePublishedProduct, getDraftProduct, updateProductDraft } from "../catalog/versions.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform, setProductCapability } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import * as publication from "../publication/products.ts";
import { makeDraft, proof, markPublished } from "./fixtures.ts";

after(closeDb);

async function completeDraft() {
  const f = await makeDraft();
  const verified = await proof();
  const args = [f.product.id, f.draft.version.id] as const;
  await addProductAlias(f.product.id, { alias: "合成 AI", locale: "ja", aliasType: "common" });
  await updateProductDraft(...args, { lifecycleStatus: "active", lifecycleEvidenceId: verified.evidenceId, lifecycleVerifiedAt: verified.verifiedAt });
  await setProductMarket(...args, { marketCode: "JP", availabilityStatus: "available", ...verified });
  await setProductLanguageSupport(...args, { languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "none", ...verified });
  await setProductPlatform(...args, { platformKey: "web", status: "available", ...verified });
  await setProductCapability(...args, { capabilityKey: "coding", supportLevel: "partial", ...verified });
  const plan = await saveProductPlan(...args, { planKey: "personal", name: "合成個人プラン", audience: "personal", billingModel: "subscription", activeStatus: "active", ...verified });
  await saveProductPrice(...args, plan.id, { priceType: "fixed", billingPeriod: "month", marketCode: "JP", currencyCode: "JPY", amountMinor: 2000, ...verified });
  return { ...f, verified };
}

test("published aggregate contains complete facts, scoped evidence metadata and no private editor", async () => {
  const f = await completeDraft();
  const unrelated = await proof();
  await markPublished(f.draft.version.id);
  const p = (await publication.getPublishedProductBySlug(f.product.slug))!;
  assert.equal(p.vendor?.id, f.vendor.id);
  assert.equal(p.aliases[0].alias, "合成 AI");
  assert.equal(p.version.lifecycleStatus, "active");
  assert.equal(p.markets[0].availabilityStatus, "available");
  assert.equal(p.languages[0].uiSupport, "none");
  assert.equal(p.platforms.find(x => x.platformKey === "web")?.status, "available");
  assert.equal(p.capabilities.find(x => x.capabilityKey === "coding")?.supportLevel, "partial");
  assert.equal(p.plans[0].prices[0].amountMinor, 2000);
  assert.ok(Array.isArray(p.evidence), "published aggregate must contain evidence metadata");
  assert.deepEqual(p.evidence.map(x => x.id), [f.verified.evidenceId]);
  assert.ok(!p.evidence.some(x => x.id === unrelated.evidenceId));
  assert.equal(p.evidence[0].sourceKind, "official_product");
  assert.ok(!("createdBy" in p.version));
  assert.ok(!("fulltext" in p.evidence[0]));
});

test("P21 published list/detail exclude drafts and superseded versions with stable pagination", async () => {
  assert.equal(typeof publication.listPublishedProducts, "function", "published-only list must exist");
  const a = await makeDraft();
  const b = await makeDraft();
  const privateOnly = await makeDraft();
  await markPublished(a.draft.version.id);
  await markPublished(b.draft.version.id);
  const next = await clonePublishedProduct(a.product.id, "private-next-editor");
  const all = await publication.listPublishedProducts({ limit: 100 });
  const ids = all.map(p => p.version.id);
  assert.ok(ids.includes(a.draft.version.id));
  assert.ok(ids.includes(b.draft.version.id));
  assert.ok(!ids.includes(next.version.id));
  assert.ok(!all.some(p => p.identity.id === privateOnly.product.id));
  assert.ok(all.every(p => p.version.status === "published" && !("createdBy" in p.version)));
  assert.deepEqual(all.map(p => p.identity.slug), all.map(p => p.identity.slug).sort());
  const page = await publication.listPublishedProducts({ limit: 1, offset: 1 });
  assert.deepEqual(page, all.slice(1, 2));
  await sql`UPDATE af_product_versions SET status='superseded', superseded_at=now() WHERE id=${a.draft.version.id}`;
  assert.equal(await publication.getPublishedProductBySlug(a.product.slug), null);
  assert.ok(!(await publication.listPublishedProducts({ limit: 100 })).some(p => p.identity.id === a.product.id));
});

test("published list validates bounded integer pagination", async () => {
  assert.equal(typeof publication.listPublishedProducts, "function");
  for (const input of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { offset: -1 }, { offset: 0.5 }]) {
    await assert.rejects(() => publication.listPublishedProducts(input));
  }
});

test("P24 lastVerifiedAt derives from definite evidence-backed facts, not updated_at or unknown/draft facts", async () => {
  const f = await makeDraft();
  const verified = await proof();
  const args = [f.product.id, f.draft.version.id] as const;
  assert.equal((await getDraftProduct(f.product.id))?.lastVerifiedAt, null);
  const withTime = (hour: number) => ({ ...verified, verifiedAt: `2026-10-05T0${hour}:00:00Z` });
  await updateProductDraft(...args, { lifecycleStatus: "beta", lifecycleEvidenceId: verified.evidenceId, lifecycleVerifiedAt: withTime(0).verifiedAt });
  assert.equal((await getDraftProduct(f.product.id))?.lastVerifiedAt, "2026-10-05T00:00:00.000Z");
  await setProductMarket(...args, { marketCode: "JP", availabilityStatus: "available", ...withTime(1) });
  await setProductLanguageSupport(...args, { languageCode: "ja", inputSupport: "full", outputSupport: "unknown", uiSupport: "unknown", ...withTime(2) });
  await setProductPlatform(...args, { platformKey: "web", status: "available", ...withTime(3) });
  await setProductCapability(...args, { capabilityKey: "text", supportLevel: "full", ...withTime(4) });
  const plan = await saveProductPlan(...args, { planKey: "test", name: "合成", activeStatus: "active", ...withTime(5) });
  await saveProductPrice(...args, plan.id, { priceType: "free", billingPeriod: "none", amountMinor: 0, ...withTime(6) });
  await setProductCapability(...args, { capabilityKey: "audio", supportLevel: "unknown", ...verified, verifiedAt: "2035-01-01T00:00:00Z" });
  await markPublished(f.draft.version.id);
  await sql`UPDATE af_products SET updated_at='2040-01-01' WHERE id=${f.product.id}`;
  const next = await clonePublishedProduct(f.product.id);
  await setProductPlatform(f.product.id, next.version.id, { platformKey: "ios", status: "available", ...verified, verifiedAt: "2036-01-01T00:00:00Z" });
  assert.equal((await publication.getPublishedProductBySlug(f.product.slug))?.lastVerifiedAt, "2026-10-05T06:00:00.000Z");
  assert.equal((await getDraftProduct(f.product.id))?.lastVerifiedAt, "2036-01-01T00:00:00.000Z");
});

test("P06 cloned draft changes every fact family without changing the published aggregate or evidence", async () => {
  const f = await completeDraft();
  await markPublished(f.draft.version.id);
  const before = await publication.getPublishedProductBySlug(f.product.slug);
  const next = await clonePublishedProduct(f.product.id);
  const verified = await proof();
  const args = [f.product.id, next.version.id] as const;
  await updateProductDraft(...args, { displayName: "非公開の編集", lifecycleStatus: "discontinued", lifecycleEvidenceId: verified.evidenceId, lifecycleVerifiedAt: verified.verifiedAt });
  await setProductMarket(...args, { marketCode: "JP", availabilityStatus: "unavailable", ...verified });
  await setProductLanguageSupport(...args, { languageCode: "ja", inputSupport: "none", outputSupport: "none", uiSupport: "full", ...verified });
  await setProductPlatform(...args, { platformKey: "web", status: "unavailable", ...verified });
  await setProductCapability(...args, { capabilityKey: "coding", supportLevel: "none", ...verified });
  const plan = await saveProductPlan(...args, { planKey: "personal", name: "非公開プラン", activeStatus: "inactive", ...verified });
  await saveProductPrice(...args, plan.id, { id: next.plans[0].prices[0].id, priceType: "custom", billingPeriod: "custom", amountMinor: null, ...verified });
  assert.deepEqual(await publication.getPublishedProductBySlug(f.product.slug), before);
  assert.equal((await getDraftProduct(f.product.id))?.plans[0].prices[0].priceType, "custom");
});
