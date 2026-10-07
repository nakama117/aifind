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
  assert.ok(existsSync(new URL("../catalog/pricing.ts", import.meta.url)), "plans and prices domain must exist");
  return import("../catalog/pricing.ts");
}
async function plan() {
  const pricing = await domain(); const { product, draft } = await makeDraft();
  const row = await pricing.saveProductPlan(product.id, draft.version.id, { planKey: "synthetic", name: "合成プラン" });
  return { pricing, product, draft, row };
}

test("P13 free price is exactly zero and never a positive amount", async () => {
  const { pricing, product: p, draft: v, row } = await plan();
  const price = await pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "none", priceType: "free", amountMinor: 0 });
  assert.equal(price.priceType, "free"); assert.equal(price.amountMinor, 0);
  await assert.rejects(pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "none", priceType: "free", amountMinor: 2000 }));
  await assert.rejects(sql`INSERT INTO af_product_prices(id,plan_id,billing_period,price_type,amount_minor) VALUES ('bad-free',${row.id},'none','free',NULL)`, { code: "23514" });
});

test("P14 unknown price is null and never interpreted as free", async () => {
  const { pricing, product: p, draft: v, row } = await plan();
  const price = await pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "none", priceType: "unknown", amountMinor: null });
  assert.equal(price.priceType, "unknown"); assert.equal(price.amountMinor, null);
  await assert.rejects(pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "none", priceType: "unknown", amountMinor: 0 }));
});

test("P15 custom sales quote is null but retains its distinct price type", async () => {
  const { pricing, product: p, draft: v, row } = await plan();
  const price = await pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "custom", priceType: "custom", amountMinor: null });
  assert.equal(price.priceType, "custom"); assert.equal(price.amountMinor, null);
  await assert.rejects(pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "custom", priceType: "custom", amountMinor: 0 }));
});

test("P16 fixed and from prices require a controlled currency and positive minor-unit amount", async () => {
  const { pricing, product: p, draft: v, row } = await plan();
  for (const priceType of ["fixed", "from"]) {
    for (const patch of [{ currencyCode: null, amountMinor: 2000 }, { currencyCode: "USD", amountMinor: null },
      { currencyCode: "USD", amountMinor: 0 }, { currencyCode: "garbage", amountMinor: 2000 }]) {
      await assert.rejects(pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "month", priceType, ...patch }));
    }
  }
  await assert.rejects(sql`INSERT INTO af_product_prices(id,plan_id,billing_period,price_type,currency_code,amount_minor)
    VALUES ('bad-fixed',${row.id},'month','fixed','USD',NULL)`, { code: "23514" });
});

test("P17 integer minor units round-trip exactly without a float money conversion", async () => {
  const { pricing, product: p, draft: v, row } = await plan();
  for (const amount of [1999, 9007199254740991]) {
    const price = await pricing.saveProductPrice(p.id, v.version.id, row.id, { billingPeriod: "month", priceType: "fixed", currencyCode: "USD", amountMinor: amount });
    assert.equal(price.amountMinor, amount);
    const [stored] = await sql<{ value: string }[]>`SELECT amount_minor::text AS value FROM af_product_prices WHERE id=${price.id}`;
    assert.equal(stored.value, amount === 1999 ? "1999" : "9007199254740991");
  }
  for (const amount of [19.99, -1, 9007199254740992]) await assert.rejects(pricing.saveProductPrice(p.id, v.version.id, row.id,
    { billingPeriod: "month", priceType: "fixed", currencyCode: "USD", amountMinor: amount }));
  const [column] = await sql<{ data_type: string }[]>`SELECT data_type FROM information_schema.columns WHERE table_name='af_product_prices' AND column_name='amount_minor'`;
  assert.equal(column.data_type, "bigint");
});

test("prices and plans reject cross-product ownership and inverted validity dates", async () => {
  const a = await plan(); const b = await plan();
  const input = { billingPeriod: "month", priceType: "fixed", currencyCode: "USD", amountMinor: 1999 };
  await assert.rejects(a.pricing.saveProductPrice(a.product.id, a.draft.version.id, b.row.id, input), /belong/);
  const price = await a.pricing.saveProductPrice(a.product.id, a.draft.version.id, a.row.id, input);
  await assert.rejects(b.pricing.saveProductPrice(b.product.id, b.draft.version.id, b.row.id, { ...input, id: price.id }), /belong/);
  await assert.rejects(a.pricing.saveProductPrice(a.product.id, a.draft.version.id, a.row.id, { ...input, validFrom: "2026-10-10", validTo: "2026-10-01" }));
});

test("monthly and yearly market prices are separate and cloned prices have new identities", async () => {
  const { pricing, product: p, draft: v } = await plan(); const verified = await proof();
  const row = await pricing.saveProductPlan(p.id, v.version.id, { planKey: "pro", name: "合成 Pro", audience: "personal", billingModel: "subscription", activeStatus: "active", ...verified });
  const month = await pricing.saveProductPrice(p.id, v.version.id, row.id, { marketCode: "JP", currencyCode: "JPY", billingPeriod: "month", priceType: "fixed", amountMinor: 2000, ...verified });
  await pricing.saveProductPrice(p.id, v.version.id, row.id, { marketCode: "US", currencyCode: "USD", billingPeriod: "year", priceType: "fixed", amountMinor: 19900,
    unitLabel: "per year", validFrom: "2026-10-01", validTo: "2026-12-31", ...verified });
  await markPublished(v.version.id);
  const published = await getPublishedProductBySlug(p.slug);
  const clone = await clonePublishedProduct(p.id);
  const copied = clone.plans.find(x => x.planKey === "pro")!;
  assert.notEqual(copied.id, row.id);
  assert.equal(copied.prices.length, 2);
  const clonedMonth = copied.prices.find(x => x.billingPeriod === "month")!;
  assert.notEqual(clonedMonth.id, month.id);
  await pricing.saveProductPrice(p.id, clone.version.id, copied.id, { id: clonedMonth.id, marketCode: "JP", currencyCode: "JPY", billingPeriod: "month", priceType: "fixed", amountMinor: 2500, ...verified });
  assert.deepEqual(await getPublishedProductBySlug(p.slug), published);
  assert.equal((await getDraftProduct(p.id))!.plans.find(x => x.planKey === "pro")!.prices.find(x => x.billingPeriod === "month")!.amountMinor, 2500);
  const annual = published!.plans.find(x => x.planKey === "pro")!.prices.find(x => x.billingPeriod === "year")!;
  assert.deepEqual([annual.marketCode, annual.currencyCode, annual.amountMinor, annual.validFrom, annual.validTo], ["US", "USD", 19900, "2026-10-01", "2026-12-31"]);
  await assert.rejects(sql`UPDATE af_product_prices SET amount_minor=2500 WHERE id=${month.id}`, /immutable/);
});
