import type { Db, Tx } from "@aihot/backend/db";
import { Conflict } from "@aihot/backend/audit";
import type { ProductSnapshot, ProductPrice, ProductPlan, Verification } from "../contracts.ts";
import type { Candidate, CandidateInput } from "../admin/contracts.ts";
import { InvalidInput } from "../admin/errors.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform, setProductCapability } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { updateProductDraft } from "../catalog/versions.ts";

type Target = Pick<Candidate, "candidateType" | "targetKey" | "targetRef">;
const proof = (p: Partial<Verification>) => ({ evidenceId: p.evidenceId ?? null, verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).toISOString() : null });
const planValue = (p: Partial<ProductPlan>) => ({ planKey: p.planKey, name: p.name, audience: p.audience ?? "unknown",
  billingModel: p.billingModel ?? "unknown", activeStatus: p.activeStatus ?? "unknown", ...proof(p) });
const priceValue = (p: Partial<ProductPrice>) => ({ marketCode: p.marketCode ?? null, currencyCode: p.currencyCode ?? null,
  billingPeriod: p.billingPeriod, priceType: p.priceType, amountMinor: p.amountMinor ?? null, unitLabel: p.unitLabel ?? null,
  validFrom: p.validFrom ?? null, validTo: p.validTo ?? null, ...proof(p) });

/** Only the seven Catalog targets are accepted. IDs and timestamps of row creation are not facts. */
export function normalizeProposal(c: CandidateInput): Record<string, unknown> {
  const p = { ...c.proposedValue, evidenceId: c.evidenceId } as Record<string, unknown>;
  switch (c.candidateType) {
    case "market": return { marketCode: p.marketCode, availabilityStatus: p.availabilityStatus, ...proof(p) };
    case "language": return { languageCode: p.languageCode, inputSupport: p.inputSupport, outputSupport: p.outputSupport, uiSupport: p.uiSupport, ...proof(p) };
    case "platform": return { platformKey: p.platformKey, status: p.status, ...proof(p) };
    case "capability": return { capabilityKey: p.capabilityKey, supportLevel: p.supportLevel, ...proof(p) };
    case "plan": return planValue(p);
    case "price": return priceValue(p);
    case "lifecycle": return { lifecycleStatus: p.lifecycleStatus, lifecycleEvidenceId: c.evidenceId,
      lifecycleVerifiedAt: p.lifecycleVerifiedAt ? new Date(p.lifecycleVerifiedAt as string).toISOString() : null };
  }
}

export async function targetValue(db: Db, p: ProductSnapshot | null, c: Target): Promise<Record<string, unknown> | null> {
  if (!p) return null;
  switch (c.candidateType) {
    case "market": { const v = p.markets.find(v => v.marketCode === c.targetKey); return v ? { marketCode: v.marketCode, availabilityStatus: v.availabilityStatus, ...proof(v) }
      : { marketCode: c.targetKey, availabilityStatus: "unknown", ...proof({}) }; }
    case "language": { const v = p.languages.find(v => v.languageCode === c.targetKey); return v ? { languageCode: v.languageCode, inputSupport: v.inputSupport, outputSupport: v.outputSupport, uiSupport: v.uiSupport, ...proof(v) }
      : { languageCode: c.targetKey, inputSupport: "unknown", outputSupport: "unknown", uiSupport: "unknown", ...proof({}) }; }
    case "platform": { const v = p.platforms.find(v => v.platformKey === c.targetKey)!; return { platformKey: v.platformKey, status: v.status, ...proof(v) }; }
    case "capability": { const v = p.capabilities.find(v => v.capabilityKey === c.targetKey)!; return { capabilityKey: v.capabilityKey, supportLevel: v.supportLevel, ...proof(v) }; }
    case "plan": { const v = p.plans.find(v => v.planKey === c.targetKey); return v ? planValue(v) : null; }
    case "price": {
      const plan = p.plans.find(v => v.planKey === c.targetKey);
      if (!plan) return null;
      if (!c.targetRef) return { prices: plan.prices.map(priceValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) };
      const [mapped] = p.version.status === "draft" ? await db`SELECT id FROM af_product_prices WHERE plan_id=${plan.id} AND base_price_id=${c.targetRef}` : [];
      const v = plan.prices.find(v => v.id === (p.version.status === "draft" ? mapped?.id : c.targetRef));
      return v ? priceValue(v) : null;
    }
    case "lifecycle": return { lifecycleStatus: p.version.lifecycleStatus, lifecycleEvidenceId: p.version.lifecycleEvidenceId, lifecycleVerifiedAt: p.version.lifecycleVerifiedAt };
  }
}
export const sameTarget = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function validateTarget(base: ProductSnapshot, c: Target) {
  if (c.candidateType !== "price") return;
  const plan = base.plans.find(v => v.planKey === c.targetKey);
  if (!plan || (c.targetRef && !plan.prices.some(v => v.id === c.targetRef))) throw new InvalidInput("対象の Plan / Price は基準 Published に属していません。");
}

export async function applyTarget(tx: Tx, productId: string, versionId: string, c: Candidate) {
  switch (c.candidateType) {
    case "market": return setProductMarket(productId, versionId, c.proposedValue, tx);
    case "language": return setProductLanguageSupport(productId, versionId, c.proposedValue, tx);
    case "platform": return setProductPlatform(productId, versionId, c.proposedValue, tx);
    case "capability": return setProductCapability(productId, versionId, c.proposedValue, tx);
    case "plan": return saveProductPlan(productId, versionId, c.proposedValue, tx);
    case "lifecycle": return updateProductDraft(productId, versionId, c.proposedValue, tx);
    case "price": {
      const [plan] = await tx`SELECT id FROM af_product_plans WHERE product_version_id=${versionId} AND plan_key=${c.targetKey}`;
      if (!plan) throw new Conflict("対象の Plan が Draft にありません。内容を再確認してください。");
      const [price] = c.targetRef ? await tx`SELECT id FROM af_product_prices WHERE plan_id=${plan.id} AND base_price_id=${c.targetRef}` : [];
      if (c.targetRef && !price) throw new Conflict("Price の基準が Draft と一致しません。内容を再確認してください。");
      return saveProductPrice(productId, versionId, plan.id, { ...c.proposedValue, ...(price ? { id: price.id } : {}) }, tx);
    }
  }
}
