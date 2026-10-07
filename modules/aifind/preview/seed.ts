import { config } from "@aihot/backend/config";
import { sql } from "@aihot/backend/db";
import { createProduct, createVendor } from "../catalog/identity.ts";
import { clonePublishedProduct, createProductDraft, getDraftProduct, updateProductDraft } from "../catalog/versions.ts";
import { createEvidence } from "../catalog/evidence.ts";
import { setProductCapability, setProductLanguageSupport, setProductMarket, setProductPlatform } from "../catalog/facts.ts";
import { saveProductPlan, saveProductPrice } from "../catalog/pricing.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
import { assertPreviewWrites } from "./config.ts";

export const PREVIEW_SLUG = "aifind-preview-product-domain";
export const PREVIEW_NAME = "[PREVIEW] Product Domain Demo";
export const DRAFT_NAME = "[PREVIEW] 下書き専用のデモ";
export const CHANGED_DRAFT_NAME = "[PREVIEW] 下書きの名前を変更済み";

/** Explicit CLI/test fixture only. Importing this file and starting the API never seeds. */
export async function seedPreviewProduct(): Promise<void> {
  assertPreviewWrites({ ...process.env, DATABASE_URL: config.databaseUrl });
  const [existing] = await sql`SELECT id, canonical_name FROM af_products WHERE slug=${PREVIEW_SLUG}`;
  if (existing) {
    if (existing.canonical_name !== PREVIEW_NAME || !await getPublishedProductBySlug(PREVIEW_SLUG) || !await getDraftProduct(existing.id)) {
      throw new Error("Preview slug is occupied or seed is incomplete; choose a fresh disposable database");
    }
    return;
  }
  const vendor = await createVendor({ slug: "aifind-preview-vendor", name: "[PREVIEW] デモベンダー", countryCode: "JP" });
  const product = await createProduct({ slug: PREVIEW_SLUG, canonicalName: PREVIEW_NAME, vendorId: vendor.id });
  const draft = await createProductDraft(product.id, { displayName: "[PREVIEW] 公開版のデモ", officialUrl: "https://preview.example.invalid/product" }, "preview-fixture");
  const evidence = await createEvidence({ sourceKind: "official_product", url: "https://preview.example.invalid/product",
    title: "[PREVIEW] 合成製品の説明", publisher: "Preview fixture", retrievedAt: "2026-10-06T00:00:00Z",
    evidenceNote: "デモデータです。実在する製品の機能・価格ではありません。外部取得は行っていません。" });
  const proof = { evidenceId: evidence.id, verifiedAt: "2026-10-06T00:00:00Z" };
  await setProductMarket(product.id, draft.version.id, { marketCode: "JP", availabilityStatus: "available", ...proof });
  await setProductLanguageSupport(product.id, draft.version.id, { languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "none", ...proof });
  await setProductPlatform(product.id, draft.version.id, { platformKey: "web", status: "available", ...proof });
  await setProductPlatform(product.id, draft.version.id, { platformKey: "android", status: "unavailable", ...proof });
  await setProductCapability(product.id, draft.version.id, { capabilityKey: "text", supportLevel: "full", ...proof });
  await setProductCapability(product.id, draft.version.id, { capabilityKey: "coding", supportLevel: "partial", ...proof });
  const pricing = await createEvidence({ sourceKind: "official_pricing", url: "https://preview.example.invalid/pricing",
    title: "[PREVIEW] 合成料金表", retrievedAt: "2026-10-06T00:00:00Z", evidenceNote: "料金タイプの表示例。実際の料金ではありません。" });
  const priceProof = { evidenceId: pricing.id, verifiedAt: "2026-10-06T00:00:00Z" };
  for (const [priceType, name, amountMinor, billingPeriod] of [
    ["free", "無料の例", 0, "none"], ["fixed", "固定料金の例", 2000, "month"],
    ["custom", "個別見積もりの例", null, "custom"], ["unknown", "未確認の例", null, "none"],
  ] as const) {
    const plan = await saveProductPlan(product.id, draft.version.id, { planKey: `preview-${priceType}`, name: `[PREVIEW] ${name}` });
    await saveProductPrice(product.id, draft.version.id, plan.id, { priceType, amountMinor, currencyCode: "JPY", marketCode: "JP", billingPeriod,
      ...(priceType === "unknown" ? {} : priceProof) });
  }
  await publishProductVersion(product.id, draft.version.id, "preview-fixture", "Initialize synthetic local Product Domain preview");
  const next = await clonePublishedProduct(product.id, "preview-fixture");
  await updateProductDraft(product.id, next.version.id, { displayName: DRAFT_NAME });
  const draftEvidence = await createEvidence({ sourceKind: "official_support", url: "https://preview.example.invalid/draft-only",
    title: "[PREVIEW] 下書き専用の根拠", retrievedAt: "2026-10-06T02:00:00Z", evidenceNote: "下書きだけが参照する合成根拠です。" });
  await setProductLanguageSupport(product.id, next.version.id, { languageCode: "ja", inputSupport: "full", outputSupport: "partial", uiSupport: "full",
    evidenceId: draftEvidence.id, verifiedAt: "2026-10-06T02:00:00Z" });
}
