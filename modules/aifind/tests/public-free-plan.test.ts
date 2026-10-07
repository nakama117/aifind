import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb } from "@aihot/backend/db";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { resolvePublicProductBySlug } from "../publication/public-products.ts";
import { publicFixture } from "./public-fixtures.ts";
after(closeDb);

for (const [instant, expected] of [
  ["2026-10-05T14:59:59Z", false],
  ["2026-10-05T15:00:00Z", true],
  ["2026-10-06T14:59:59Z", true],
  ["2026-10-06T15:00:00Z", false],
] as const) test(`Published free price uses inclusive Tokyo validity dates at ${instant}`, async t => {
  const f = await publicFixture("listed", async (f, p) => {
    const plan = await saveProductPlan(f.product.id, f.draft.version.id, { planKey: "free", name: "One Tokyo day", activeStatus: "active", ...p });
    await saveProductPrice(f.product.id, f.draft.version.id, plan.id, { priceType: "free", amountMinor: 0, billingPeriod: "none", validFrom: "2026-10-06", validTo: "2026-10-06", ...p });
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(instant) });
  const result = await resolvePublicProductBySlug(f.product.slug);
  assert.equal(result.kind, "found");
  if (result.kind === "found") assert.equal(result.product.hasCurrentFreePlan, expected);
});

test("a free price on a plan whose activity is unknown is not a confirmed current free plan", async () => {
  const f = await publicFixture("listed", async (f, p) => {
    const plan = await saveProductPlan(f.product.id, f.draft.version.id, { planKey: "free", name: "Unknown activity", activeStatus: "unknown", ...p });
    await saveProductPrice(f.product.id, f.draft.version.id, plan.id, { priceType: "free", amountMinor: 0, billingPeriod: "none", ...p });
  });
  const result = await resolvePublicProductBySlug(f.product.slug);
  assert.equal(result.kind, "found");
  if (result.kind === "found") assert.equal(result.product.hasCurrentFreePlan, false);
});
