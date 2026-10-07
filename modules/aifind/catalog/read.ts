import type { Db } from "@aihot/backend/db";
import type { ProductSnapshot, PublishedProduct, DraftProduct, VersionMetadata } from "../contracts.ts";
import { PLATFORM_KEYS, CAPABILITY_KEYS } from "../contracts.ts";
import type { ProductMarket, ProductLanguageSupport, ProductPlatform, ProductCapability, ProductPlan, ProductPrice, Verification } from "../contracts.ts";
import { identityDto, aliasDto, vendorDto } from "./identity.ts";
import type { IdentityRow, AliasRow, VendorRow } from "./identity.ts";
import { evidenceDto } from "./evidence.ts";
import type { EvidenceRow } from "./evidence.ts";
import { lastVerifiedAt } from "./verification.ts";

export interface VersionRow {
  id: string; product_id: string; version_no: number; status: "draft" | "published" | "superseded";
  display_name: string; official_url: string | null; lifecycle_status: VersionMetadata["lifecycleStatus"];
  summary_ja: string | null;
  created_at: Date; created_by: string | null; published_at: Date | null; superseded_at: Date | null;
  lifecycle_evidence_id: string | null; lifecycle_verified_at: Date | null;
  revision: number; base_version_id: string | null;
}
interface VerificationRow { verified_at: Date | null; evidence_id: string | null }
export interface MarketRow extends VerificationRow {
  id: string; product_version_id: string; market_code: ProductMarket["marketCode"]; availability_status: ProductMarket["availabilityStatus"];
}
interface LanguageRow extends VerificationRow {
  product_version_id: string; language_code: ProductLanguageSupport["languageCode"];
  input_support: ProductLanguageSupport["inputSupport"]; output_support: ProductLanguageSupport["outputSupport"]; ui_support: ProductLanguageSupport["uiSupport"];
}
interface PlatformRow extends VerificationRow {
  product_version_id: string; platform_key: ProductPlatform["platformKey"]; status: ProductPlatform["status"];
}
interface CapabilityRow extends VerificationRow {
  product_version_id: string; capability_key: ProductCapability["capabilityKey"]; support_level: ProductCapability["supportLevel"];
}
export interface PlanRow extends VerificationRow {
  id: string; product_version_id: string; plan_key: string; name: string;
  audience: ProductPlan["audience"]; billing_model: ProductPlan["billingModel"]; active_status: ProductPlan["activeStatus"];
}
export interface PriceRow extends VerificationRow {
  id: string; plan_id: string; market_code: ProductPrice["marketCode"]; currency_code: ProductPrice["currencyCode"];
  billing_period: ProductPrice["billingPeriod"]; price_type: ProductPrice["priceType"]; amount_minor: number | null;
  unit_label: string | null; valid_from: string | null; valid_to: string | null;
}
export const verificationDto = (r: VerificationRow): Verification => ({ verifiedAt: r.verified_at?.toISOString() ?? null, evidenceId: r.evidence_id });
export const planDto = (r: PlanRow): ProductPlan => ({ id: r.id, productVersionId: r.product_version_id,
  planKey: r.plan_key, name: r.name, audience: r.audience, billingModel: r.billing_model, activeStatus: r.active_status, ...verificationDto(r) });
export const priceDto = (r: PriceRow): ProductPrice => ({ id: r.id, planId: r.plan_id, marketCode: r.market_code,
  currencyCode: r.currency_code, billingPeriod: r.billing_period, priceType: r.price_type, amountMinor: r.amount_minor,
  unitLabel: r.unit_label, validFrom: r.valid_from, validTo: r.valid_to, ...verificationDto(r) });
export const versionDto = (r: VersionRow): ProductSnapshot["version"] => ({
  id: r.id, productId: r.product_id, versionNo: r.version_no, status: r.status, displayName: r.display_name,
  summaryJa: r.summary_ja,
  officialUrl: r.official_url, lifecycleStatus: r.lifecycle_status, createdAt: r.created_at.toISOString(),
  publishedAt: r.published_at?.toISOString() ?? null, supersededAt: r.superseded_at?.toISOString() ?? null,
  lifecycleEvidenceId: r.lifecycle_evidence_id, lifecycleVerifiedAt: r.lifecycle_verified_at?.toISOString() ?? null,
});

/** Called with one transaction snapshot; every mutable fact is selected by these version IDs. */
export async function readProducts(db: Db, versions: VersionRow[]): Promise<ProductSnapshot[]> {
  if (!versions.length) return [];
  const productIds = versions.map(v => v.product_id);
  const versionIds = versions.map(v => v.id);
  const identities = await db<IdentityRow[]>`SELECT id, vendor_id, slug, canonical_name, created_at, updated_at
    FROM af_products WHERE id IN ${db(productIds)}`;
  const vendorIds = identities.map(p => p.vendor_id).filter((id): id is string => id !== null);
  const vendors = vendorIds.length ? await db<VendorRow[]>`SELECT id, slug, name, legal_name, official_url, country_code,
    status, created_at, updated_at FROM af_vendors WHERE id IN ${db(vendorIds)}` : [];
  const aliases = await db<AliasRow[]>`SELECT id, product_id, alias, normalized_alias, locale, alias_type, created_at
    FROM af_product_aliases WHERE product_id IN ${db(productIds)} ORDER BY normalized_alias, id`;
  const byProduct = new Map(identities.map(p => [p.id, p]));
  const byVendor = new Map(vendors.map(v => [v.id, v]));
  const markets = await db<MarketRow[]>`SELECT id, product_version_id, market_code, availability_status, verified_at, evidence_id
    FROM af_product_markets WHERE product_version_id IN ${db(versionIds)} ORDER BY market_code, id`;
  const languages = await db<LanguageRow[]>`SELECT product_version_id, language_code, input_support, output_support, ui_support, verified_at, evidence_id
    FROM af_product_language_support WHERE product_version_id IN ${db(versionIds)} ORDER BY language_code`;
  const platforms = await db<PlatformRow[]>`SELECT product_version_id, platform_key, status, verified_at, evidence_id
    FROM af_product_platforms WHERE product_version_id IN ${db(versionIds)}`;
  const capabilities = await db<CapabilityRow[]>`SELECT product_version_id, capability_key, support_level, verified_at, evidence_id
    FROM af_product_capabilities WHERE product_version_id IN ${db(versionIds)}`;
  const plans = await db<PlanRow[]>`SELECT id, product_version_id, plan_key, name, audience, billing_model, active_status, verified_at, evidence_id
    FROM af_product_plans WHERE product_version_id IN ${db(versionIds)} ORDER BY plan_key, id`;
  const prices = await db<PriceRow[]>`SELECT r.id, r.plan_id, r.market_code, r.currency_code, r.billing_period, r.price_type, r.amount_minor,
    r.unit_label, r.valid_from::text AS valid_from, r.valid_to::text AS valid_to, r.verified_at, r.evidence_id
    FROM af_product_prices r JOIN af_product_plans p ON p.id=r.plan_id WHERE p.product_version_id IN ${db(versionIds)}
    ORDER BY r.market_code NULLS FIRST, r.billing_period, r.id`;
  const evidenceIds = [...new Set([
    ...versions.map(v => v.lifecycle_evidence_id),
    ...[...markets, ...languages, ...platforms, ...capabilities, ...plans, ...prices].map(f => f.evidence_id),
  ].filter((id): id is string => id !== null))];
  const evidence = evidenceIds.length ? await db<EvidenceRow[]>`SELECT id, url, title, publisher, source_kind,
    retrieved_at, published_at, content_hash, evidence_note, created_at FROM af_evidence WHERE id IN ${db(evidenceIds)} ORDER BY id` : [];
  return versions.map(v => {
    const p = byProduct.get(v.product_id)!;
    const vendor = p.vendor_id ? byVendor.get(p.vendor_id) : null;
    const versionMarkets: ProductMarket[] = markets.filter(m => m.product_version_id === v.id).map(m => ({ id: m.id,
      productVersionId: m.product_version_id, marketCode: m.market_code, availabilityStatus: m.availability_status, ...verificationDto(m) }));
    if (!versionMarkets.some(m => m.marketCode === "JP")) versionMarkets.unshift({ id: null, productVersionId: v.id,
      marketCode: "JP", availabilityStatus: "unknown", verifiedAt: null, evidenceId: null });
    const versionLanguages: ProductLanguageSupport[] = languages.filter(l => l.product_version_id === v.id).map(l => ({
      productVersionId: l.product_version_id, languageCode: l.language_code, inputSupport: l.input_support,
      outputSupport: l.output_support, uiSupport: l.ui_support, ...verificationDto(l) }));
    if (!versionLanguages.some(l => l.languageCode === "ja")) versionLanguages.push({ productVersionId: v.id,
      languageCode: "ja", inputSupport: "unknown", outputSupport: "unknown", uiSupport: "unknown", verifiedAt: null, evidenceId: null });
    const snapshot: ProductSnapshot = { identity: identityDto(p), vendor: vendor ? vendorDto(vendor) : null,
      aliases: aliases.filter(a => a.product_id === p.id).map(aliasDto), version: versionDto(v),
      markets: versionMarkets, languages: versionLanguages,
      plans: plans.filter(plan => plan.product_version_id === v.id).map(plan => ({ ...planDto(plan),
        prices: prices.filter(price => price.plan_id === plan.id).map(priceDto) })),
      platforms: PLATFORM_KEYS.map(platformKey => {
        const row = platforms.find(f => f.product_version_id === v.id && f.platform_key === platformKey);
        return { productVersionId: v.id, platformKey, status: row?.status ?? "unknown",
          ...(row ? verificationDto(row) : { verifiedAt: null, evidenceId: null }) };
      }),
      capabilities: CAPABILITY_KEYS.map(capabilityKey => {
        const row = capabilities.find(c => c.product_version_id === v.id && c.capability_key === capabilityKey);
        return { productVersionId: v.id, capabilityKey, supportLevel: row?.support_level ?? "unknown",
          ...(row ? verificationDto(row) : { verifiedAt: null, evidenceId: null }) };
      }), evidence: [], lastVerifiedAt: null };
    const refs = new Set([
      snapshot.version.lifecycleEvidenceId,
      ...[...snapshot.markets, ...snapshot.languages, ...snapshot.platforms, ...snapshot.capabilities, ...snapshot.plans].map(f => f.evidenceId),
      ...snapshot.plans.flatMap(plan => plan.prices.map(price => price.evidenceId)),
    ]);
    snapshot.evidence = evidence.filter(e => refs.has(e.id)).map(evidenceDto);
    snapshot.lastVerifiedAt = lastVerifiedAt(snapshot);
    return snapshot;
  });
}

export function publishedDto(p: ProductSnapshot): PublishedProduct {
  if (p.version.status !== "published") throw new Error("published reader received a non-published version");
  return { ...p, version: { ...p.version, status: "published" } };
}
export function draftDto(p: ProductSnapshot, createdBy: string | null): DraftProduct {
  if (p.version.status !== "draft") throw new Error("draft reader received a non-draft version");
  return { ...p, version: { ...p.version, status: "draft", createdBy } };
}
