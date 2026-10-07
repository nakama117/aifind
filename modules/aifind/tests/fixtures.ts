import "../../../tests/setup.ts";
import { sql } from "@aihot/backend/db";
import { tag } from "../../../tests/setup.ts";
import { createProduct, createVendor } from "../catalog/identity.ts";
import { createProductDraft } from "../catalog/versions.ts";
import { createEvidence } from "../catalog/evidence.ts";

export async function makeDraft() {
  const vendor = await createVendor({ slug: `synthetic-vendor-${tag()}`, name: "Synthetic vendor", countryCode: "JP" });
  const product = await createProduct({ slug: `synthetic-product-${tag()}`, canonicalName: "Synthetic product", vendorId: vendor.id });
  const draft = await createProductDraft(product.id, { displayName: "テスト用の合成製品" }, "private-fixture-editor");
  return { product, draft, vendor };
}
export async function proof() {
  const evidence = await createEvidence({ url: "https://synthetic.example/product", sourceKind: "official_product",
    retrievedAt: "2026-10-05T00:00:00Z", evidenceNote: "合成 fixture。実際の製品事実ではない。" });
  return { evidenceId: evidence.id, verifiedAt: "2026-10-05T01:00:00Z" };
}
export async function markPublished(versionId: string) {
  await sql`UPDATE af_product_versions SET status='published', published_at='2026-10-05T02:00:00Z' WHERE id=${versionId}`;
}
