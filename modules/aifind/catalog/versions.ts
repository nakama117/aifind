import { sql } from "@aihot/backend/db";
import type { Tx } from "@aihot/backend/db";
import { Conflict } from "@aihot/backend/audit";
import { newUuid } from "@aihot/backend/lib/ids";
import { DraftSchema, DraftUpdateSchema } from "../contracts.ts";
import type { DraftProduct } from "../contracts.ts";
import { readProducts, draftDto } from "./read.ts";
import type { VersionRow } from "./read.ts";
import type { MarketRow, PlanRow, PriceRow } from "./read.ts";

async function lockProduct(tx: Tx, productId: string) {
  const [p] = await tx`SELECT id FROM af_products WHERE id=${productId} FOR UPDATE`;
  if (!p) throw new Error("product not found");
  const [draft] = await tx`SELECT id FROM af_product_versions WHERE product_id=${productId} AND status='draft'`;
  if (draft) throw new Conflict("product already has a draft");
}
async function nextVersion(tx: Tx, productId: string): Promise<number> {
  const [r] = await tx<{ next: number }[]>`SELECT coalesce(max(version_no), 0) + 1 AS next FROM af_product_versions WHERE product_id=${productId}`;
  return r.next;
}

export async function createProductDraft(productId: string, input: unknown, createdBy: string | null = null, db?: Tx): Promise<DraftProduct> {
  const v = DraftSchema.parse(input);
  const create = async (tx: Tx) => {
    await lockProduct(tx, productId);
    const [row] = await tx<VersionRow[]>`INSERT INTO af_product_versions (id, product_id, version_no, display_name, official_url, lifecycle_status, created_by, lifecycle_evidence_id, lifecycle_verified_at, summary_ja)
      VALUES (${newUuid()}, ${productId}, ${await nextVersion(tx, productId)}, ${v.displayName}, ${v.officialUrl ?? null}, ${v.lifecycleStatus ?? "unknown"}, ${createdBy}, ${v.lifecycleEvidenceId ?? null}, ${v.lifecycleVerifiedAt ?? null}, ${v.summaryJa ?? null}) RETURNING *`;
    return draftDto((await readProducts(tx, [row]))[0], row.created_by);
  };
  return db ? create(db) : sql.begin(create);
}

export async function clonePublishedProduct(productId: string, createdBy: string | null = null, db?: Tx): Promise<DraftProduct> {
  const clone = async (tx: Tx) => {
    await lockProduct(tx, productId);
    const [published] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} AND status='published' FOR UPDATE`;
    if (!published) throw new Error("published version not found");
    const [draft] = await tx<VersionRow[]>`INSERT INTO af_product_versions (id, product_id, version_no, display_name, official_url, lifecycle_status, created_by, lifecycle_evidence_id, lifecycle_verified_at, base_version_id, summary_ja)
      VALUES (${newUuid()}, ${productId}, ${await nextVersion(tx, productId)}, ${published.display_name}, ${published.official_url}, ${published.lifecycle_status}, ${createdBy}, ${published.lifecycle_evidence_id}, ${published.lifecycle_verified_at}, ${published.id}, ${published.summary_ja}) RETURNING *`;
    await cloneFacts(tx, published.id, draft.id);
    return draftDto((await readProducts(tx, [draft]))[0], draft.created_by);
  };
  return db ? clone(db) : sql.begin(clone);
}

async function cloneFacts(tx: Tx, fromId: string, toId: string): Promise<void> {
  const markets = await tx<MarketRow[]>`SELECT id, product_version_id, market_code, availability_status, verified_at, evidence_id FROM af_product_markets WHERE product_version_id=${fromId}`;
  for (const m of markets) await tx`INSERT INTO af_product_markets(id, product_version_id, market_code, availability_status, verified_at, evidence_id)
    VALUES (${newUuid()}, ${toId}, ${m.market_code}, ${m.availability_status}, ${m.verified_at}, ${m.evidence_id})`;
  await tx`INSERT INTO af_product_language_support(product_version_id, language_code, input_support, output_support, ui_support, verified_at, evidence_id)
    SELECT ${toId}, language_code, input_support, output_support, ui_support, verified_at, evidence_id FROM af_product_language_support WHERE product_version_id=${fromId}`;
  await tx`INSERT INTO af_product_platforms(product_version_id, platform_key, status, verified_at, evidence_id)
    SELECT ${toId}, platform_key, status, verified_at, evidence_id FROM af_product_platforms WHERE product_version_id=${fromId}`;
  await tx`INSERT INTO af_product_capabilities(product_version_id, capability_key, support_level, verified_at, evidence_id)
    SELECT ${toId}, capability_key, support_level, verified_at, evidence_id FROM af_product_capabilities WHERE product_version_id=${fromId}`;
  const plans = await tx<PlanRow[]>`SELECT * FROM af_product_plans WHERE product_version_id=${fromId} ORDER BY id`;
  for (const plan of plans) {
    const newPlanId = newUuid();
    await tx`INSERT INTO af_product_plans(id, product_version_id, plan_key, name, audience, billing_model, active_status, verified_at, evidence_id)
      VALUES (${newPlanId}, ${toId}, ${plan.plan_key}, ${plan.name}, ${plan.audience}, ${plan.billing_model}, ${plan.active_status}, ${plan.verified_at}, ${plan.evidence_id})`;
    const prices = await tx<PriceRow[]>`SELECT id, plan_id, market_code, currency_code, billing_period, price_type, amount_minor, unit_label,
      valid_from::text AS valid_from, valid_to::text AS valid_to, verified_at, evidence_id FROM af_product_prices WHERE plan_id=${plan.id} ORDER BY id`;
    for (const price of prices) await tx`INSERT INTO af_product_prices(id, plan_id, market_code, currency_code, billing_period, price_type, amount_minor,
      unit_label, valid_from, valid_to, verified_at, evidence_id, base_price_id) VALUES (${newUuid()}, ${newPlanId}, ${price.market_code}, ${price.currency_code},
      ${price.billing_period}, ${price.price_type}, ${price.amount_minor}, ${price.unit_label}, ${price.valid_from}, ${price.valid_to}, ${price.verified_at}, ${price.evidence_id}, ${price.id})`;
  }
}

/** All fact writes lock this same parent row, so publication cannot interleave with a draft edit. */
export const STALE_DRAFT_MESSAGE = "この下書きは別の操作で更新されています。最新の内容を再読み込みしてください。";
export async function editDraft<T>(productId: string, versionId: string, fn: (tx: Tx) => Promise<T>, db?: Tx): Promise<T> {
  const edit = async (tx: Tx) => {
    const [v] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE id=${versionId} FOR UPDATE`;
    if (!v || v.product_id !== productId) throw new Error("version does not belong to product");
    if (v.status !== "draft") throw new Conflict("only a draft can be edited");
    return fn(tx);
  };
  return (db ? edit(db) : sql.begin(edit)) as Promise<T>;
}

export async function updateProductDraft(productId: string, versionId: string, input: unknown, db?: Tx): Promise<void> {
  const v = DraftUpdateSchema.parse(input);
  const change = Object.fromEntries(Object.entries({ display_name: v.displayName, official_url: v.officialUrl, summary_ja: v.summaryJa,
    lifecycle_status: v.lifecycleStatus, lifecycle_evidence_id: v.lifecycleEvidenceId,
    lifecycle_verified_at: v.lifecycleVerifiedAt }).filter(([, value]) => value !== undefined));
  if (!Object.keys(change).length) return;
  await editDraft(productId, versionId, async tx => { await tx`UPDATE af_product_versions SET ${tx(change)} WHERE id=${versionId}`; }, db);
}

export async function getDraftProduct(productId: string): Promise<DraftProduct | null> {
  return sql.begin("isolation level repeatable read read only", async tx => {
    const [v] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} AND status='draft'`;
    return v ? draftDto((await readProducts(tx, [v]))[0], v.created_by) : null;
  });
}
