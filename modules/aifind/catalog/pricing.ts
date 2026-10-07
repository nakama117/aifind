import type { Tx } from "@aihot/backend/db";
import { newUuid } from "@aihot/backend/lib/ids";
import { PlanSchema, PriceSchema } from "../contracts.ts";
import type { ProductPlan, ProductPrice } from "../contracts.ts";
import { editDraft } from "./versions.ts";
import { planDto, priceDto } from "./read.ts";
import type { PlanRow, PriceRow } from "./read.ts";

export async function saveProductPlan(productId: string, versionId: string, input: unknown, db?: Tx): Promise<ProductPlan> {
  const p = PlanSchema.parse(input);
  return editDraft(productId, versionId, async tx => {
    const [row] = await tx<PlanRow[]>`INSERT INTO af_product_plans(id, product_version_id, plan_key, name, audience, billing_model, active_status, verified_at, evidence_id)
      VALUES (${newUuid()}, ${versionId}, ${p.planKey}, ${p.name}, ${p.audience ?? "unknown"}, ${p.billingModel ?? "unknown"}, ${p.activeStatus ?? "unknown"}, ${p.verifiedAt ?? null}, ${p.evidenceId ?? null})
      ON CONFLICT(product_version_id, plan_key) DO UPDATE SET name=excluded.name, audience=excluded.audience,
      billing_model=excluded.billing_model, active_status=excluded.active_status, verified_at=excluded.verified_at, evidence_id=excluded.evidence_id RETURNING *`;
    return planDto(row);
  }, db);
}

/** With id this replaces that draft price; omission creates a separate price component. */
export async function saveProductPrice(productId: string, versionId: string, planId: string, input: unknown, db?: Tx): Promise<ProductPrice> {
  const p = PriceSchema.parse(input);
  return editDraft(productId, versionId, async tx => {
    const [plan] = await tx`SELECT id FROM af_product_plans WHERE id=${planId} AND product_version_id=${versionId}`;
    if (!plan) throw new Error("plan does not belong to product version");
    const values = { plan_id: planId, market_code: p.marketCode ?? null, currency_code: p.currencyCode ?? null,
      billing_period: p.billingPeriod, price_type: p.priceType, amount_minor: p.amountMinor ?? null,
      unit_label: p.unitLabel ?? null, valid_from: p.validFrom ?? null, valid_to: p.validTo ?? null,
      verified_at: p.verifiedAt ?? null, evidence_id: p.evidenceId ?? null };
    let row: PriceRow;
    if (p.id) {
      const [found] = await tx<PriceRow[]>`UPDATE af_product_prices SET ${tx(values)} WHERE id=${p.id} AND plan_id=${planId}
        RETURNING id, plan_id, market_code, currency_code, billing_period, price_type, amount_minor, unit_label,
          valid_from::text AS valid_from, valid_to::text AS valid_to, verified_at, evidence_id`;
      if (!found) throw new Error("price does not belong to plan");
      row = found;
    } else {
      [row] = await tx<PriceRow[]>`INSERT INTO af_product_prices ${tx({ id: newUuid(), ...values })}
        RETURNING id, plan_id, market_code, currency_code, billing_period, price_type, amount_minor, unit_label,
          valid_from::text AS valid_from, valid_to::text AS valid_to, verified_at, evidence_id`;
    }
    return priceDto(row);
  }, db);
}
