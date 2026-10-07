import { config } from "@aihot/backend/config";
import { sql } from "@aihot/backend/db";
import { createAdminVendor, createAdminProduct, createAdminDraft, saveAdminDraft, publishAdminDraft, addAdminEvidence } from "../admin/products.ts";
import { createCandidate, reviewCandidate } from "../changes/candidates.ts";
import { assertPreviewWrites } from "./config.ts";

export const ADMIN_PREVIEW_A = "aifind-preview-admin-a", ADMIN_PREVIEW_B = "aifind-preview-admin-b";
const actor = "preview-fixture", reason = "[PREVIEW] Phase 2 合成データの初期化";
interface AdminPreviewFixture { productAId: string; productBId: string; pendingCandidateId: string; approvedCandidateId: string; staleCandidateId: string }

/** Explicit CLI/test-only initialization. No import or API/Web startup calls this function. */
export async function seedAdminPreview(): Promise<AdminPreviewFixture> {
  assertPreviewWrites({ ...process.env, DATABASE_URL: config.databaseUrl });
  const existing = await sql`SELECT id,slug,canonical_name FROM af_products WHERE slug IN (${ADMIN_PREVIEW_A},${ADMIN_PREVIEW_B})`;
  if (existing.length) {
    if (existing.length !== 2 || existing.some(p => !p.canonical_name.startsWith("[PREVIEW]"))) throw new Error("Preview identity collision or incomplete seed; use a fresh disposable database");
    const productAId = existing.find(p => p.slug === ADMIN_PREVIEW_A)!.id, productBId = existing.find(p => p.slug === ADMIN_PREVIEW_B)!.id;
    const rows = await sql`SELECT id,product_id,candidate_type,target_key FROM af_product_change_candidates WHERE product_id IN (${productAId},${productBId}) ORDER BY created_at,id`;
    const pending = rows.find(c => c.product_id === productBId && c.candidate_type === "platform" && c.target_key === "linux");
    const approved = rows.find(c => c.product_id === productBId && c.candidate_type === "price" && c.target_key === "preview-fixed");
    const stale = rows.find(c => c.product_id === productAId && c.candidate_type === "market" && c.target_key === "JP");
    if (!pending || !approved || !stale) throw new Error("Preview candidate seed is incomplete; use a fresh disposable database");
    return { productAId, productBId, pendingCandidateId: pending.id, approvedCandidateId: approved.id, staleCandidateId: stale.id };
  }
  const vendor = await createAdminVendor({ slug: "aifind-preview-admin-vendor", name: "[PREVIEW] 管理デモベンダー", countryCode: "JP", reason }, actor);
  const productEvidence = await addAdminEvidence({ url: "https://preview.example.invalid/phase2/product", sourceKind: "official_product",
    title: "[PREVIEW] 合成製品の説明", publisher: "Preview fixture", retrievedAt: "2026-10-06T00:00:00Z", evidenceNote: "実在する製品ではありません。外部取得は行っていません。", reason }, actor);
  const pricingEvidence = await addAdminEvidence({ url: "https://preview.example.invalid/phase2/pricing", sourceKind: "official_pricing",
    title: "[PREVIEW] 合成料金表", publisher: "Preview fixture", retrievedAt: "2026-10-06T00:00:00Z", evidenceNote: "無料・固定・見積もり・未確認の表示確認用です。", reason }, actor);
  const proof = { evidenceId: productEvidence.id, verifiedAt: "2026-10-06T00:00:00Z" }, priceProof = { evidenceId: pricingEvidence.id, verifiedAt: "2026-10-06T00:00:00Z" };
  const create = async (slug: string, label: string) => {
    const p = await createAdminProduct({ slug, canonicalName: `[PREVIEW] Product ${label}`, vendorId: vendor.id, reason }, actor);
    const d = await createAdminDraft(p.id, { reason }, actor);
    const saved = await saveAdminDraft(p.id, d.draft.version.id, { expectedRevision: d.revision, reason,
      version: { displayName: `[PREVIEW] Product ${label} · Published`, officialUrl: `https://preview.example.invalid/phase2/${label.toLowerCase()}` },
      markets: [{ marketCode: "JP", availabilityStatus: "unknown" }],
      languages: [{ languageCode: "ja", inputSupport: "full", outputSupport: "full", uiSupport: "unknown", ...proof }],
      platforms: [{ platformKey: "web", status: "available", ...proof }, { platformKey: "android", status: "unavailable", ...proof }],
      capabilities: [{ capabilityKey: "text", supportLevel: "full", ...proof }, { capabilityKey: "coding", supportLevel: "partial", ...proof }],
      plans: [
        { planKey: "preview-free", name: "[PREVIEW] 無料の例", prices: [{ priceType: "free", amountMinor: 0, billingPeriod: "none", ...priceProof }] },
        { planKey: "preview-fixed", name: "[PREVIEW] 固定料金の例", prices: [{ priceType: "fixed", amountMinor: 1999, currencyCode: "USD", marketCode: "JP", billingPeriod: "month", ...priceProof }] },
        { planKey: "preview-custom", name: "[PREVIEW] 個別見積もりの例", prices: [{ priceType: "custom", amountMinor: null, billingPeriod: "custom", ...priceProof }] },
        { planKey: "preview-unknown", name: "[PREVIEW] 未確認の例", prices: [{ priceType: "unknown", amountMinor: null, billingPeriod: "none" }] },
      ] }, actor);
    const published = await publishAdminDraft(p.id, d.draft.version.id, { expectedRevision: saved.revision, reason }, actor);
    return { p, published };
  };
  const a = await create(ADMIN_PREVIEW_A, "A"), b = await create(ADMIN_PREVIEW_B, "B");
  const draft = await createAdminDraft(a.p.id, { reason }, actor);
  await saveAdminDraft(a.p.id, draft.draft.version.id, { expectedRevision: draft.revision, version: { displayName: "[PREVIEW] Product A · Draft" }, reason }, actor);
  const pending = await createCandidate({ productId: b.p.id, baseVersionId: b.published.version.id, candidateType: "platform", targetKey: "linux", proposedValue: { platformKey: "linux", status: "available", ...proof }, evidenceId: proof.evidenceId, sourceType: "manual", reason }, actor);
  const approved = await createCandidate({ productId: b.p.id, baseVersionId: b.published.version.id, candidateType: "price", targetKey: "preview-fixed", proposedValue: { priceType: "fixed", currencyCode: "USD", amountMinor: 2099, billingPeriod: "month", ...priceProof }, evidenceId: priceProof.evidenceId, sourceType: "manual", reason }, actor);
  await reviewCandidate(approved.id, "approve", { reason }, actor);
  const stale = await createCandidate({ productId: a.p.id, baseVersionId: a.published.version.id, candidateType: "market", targetKey: "JP", proposedValue: { marketCode: "JP", availabilityStatus: "available", ...proof }, evidenceId: proof.evidenceId, sourceType: "manual", reason }, actor);
  await reviewCandidate(stale.id, "approve", { reason }, actor);
  return { productAId: a.p.id, productBId: b.p.id, pendingCandidateId: pending.id, approvedCandidateId: approved.id, staleCandidateId: stale.id };
}
