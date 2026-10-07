import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { makeDraft, proof } from "./fixtures.ts";
import { updateProductDraft, clonePublishedProduct, getDraftProduct } from "../catalog/versions.ts";
import { setProductMarket, setProductLanguageSupport, setProductPlatform } from "../catalog/facts.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { getPublishedProductBySlug } from "../publication/products.ts";
after(closeDb);

async function settings() { return import("../catalog/public-settings.ts"); }
async function ready(omit?: "summary" | "JP" | "ja" | "verification") {
  const f = await makeDraft();
  await updateProductDraft(f.product.id, f.draft.version.id, { officialUrl: "https://synthetic.example/product", ...(omit !== "summary" ? { summaryJa: "テスト用の製品。文章作成を支援します。" } : {}) });
  const p = await proof();
  if (omit !== "JP") await setProductMarket(f.product.id, f.draft.version.id, { marketCode: "JP", availabilityStatus: "unknown" });
  if (omit !== "ja") await setProductLanguageSupport(f.product.id, f.draft.version.id, { languageCode: "ja", inputSupport: "unknown", outputSupport: "unknown", uiSupport: "unknown" });
  if (omit !== "verification") await setProductPlatform(f.product.id, f.draft.version.id, { platformKey: "web", status: "available", ...p });
  const published = await publishProductVersion(f.product.id, f.draft.version.id, "test-editor", "Private test publication");
  return { ...f, published };
}
async function change(id: string, visibility: "private" | "unlisted" | "listed") {
  const [r] = await sql`SELECT identity_revision FROM af_products WHERE id=${id}`;
  return (await settings()).setProductPublicVisibility(id, { visibility, expectedRevision: r.identity_revision, reason: "Synthetic visibility test" }, "test-editor");
}

test("summary is versioned: cloned Draft edits never change Published text", async () => {
  const f = await ready(); const d = await clonePublishedProduct(f.product.id, "test-editor");
  assert.equal(d.version.summaryJa, "テスト用の製品。文章作成を支援します。");
  await updateProductDraft(f.product.id, d.version.id, { summaryJa: "下書きだけの説明" });
  assert.equal((await getDraftProduct(f.product.id))!.version.summaryJa, "下書きだけの説明");
  assert.equal((await getPublishedProductBySlug(f.product.slug))!.version.summaryJa, "テスト用の製品。文章作成を支援します。");
  await assert.rejects(sql`UPDATE af_product_versions SET summary_ja='illegal' WHERE id=${f.published.version.id}`, /immutable/);
});
test("W25 public transition rejects a product without a Published version", async () => {
  const f = await makeDraft(); await assert.rejects(change(f.product.id, "listed"), /Published/);
});
for (const [missing, error, id] of [["summary", /日本語.*説明/, "W24"], ["JP", /JP/, "W26"], ["ja", /日本語.*レコード/, "W27"], ["verification", /確認日時/, "W28"]] as const) {
  test(`${id} missing ${missing} blocks a public transition without mutating state or audit`, async () => {
    const f = await ready(missing);
    await assert.rejects(change(f.product.id, "listed"), error);
    const [row] = await sql`SELECT public_visibility,first_public_at FROM af_products WHERE id=${f.product.id}`;
    assert.equal(row.public_visibility, "private"); assert.equal(row.first_public_at, null);
    assert.equal((await sql`SELECT 1 FROM audit_log WHERE action='aifind.product.visibility' AND subject=${`aifind:product:${f.product.id}`}`).length, 0);
  });
}
test("unknown JP and Japanese values are valid actual records; first_public_at survives withdrawal", async () => {
  const f = await ready(); const a = await change(f.product.id, "unlisted");
  assert.equal(a.visibility, "unlisted"); assert.ok(a.firstPublicAt);
  const b = await change(f.product.id, "private"), c = await change(f.product.id, "listed");
  assert.equal(b.firstPublicAt, a.firstPublicAt); assert.equal(c.firstPublicAt, a.firstPublicAt);
  await assert.rejects(sql`UPDATE af_products SET first_public_at=NULL WHERE id=${f.product.id}`, /first_public_at/);
});
test("W29 a public product cannot publish a replacement with missing summary; previous version survives", async () => {
  const f = await ready(); await change(f.product.id, "listed");
  const d = await clonePublishedProduct(f.product.id, "test-editor");
  await updateProductDraft(f.product.id, d.version.id, { summaryJa: null });
  await assert.rejects(publishProductVersion(f.product.id, d.version.id, "test-editor", "Invalid public replacement"), /日本語.*説明/);
  assert.equal((await getPublishedProductBySlug(f.product.slug))!.version.id, f.published.version.id);
  assert.equal((await getDraftProduct(f.product.id))!.version.id, d.version.id);
});
test("W30 private products still publish domain-valid, SEO-incomplete versions", async () => {
  const f = await makeDraft(); const p = await publishProductVersion(f.product.id, f.draft.version.id, "test-editor", "Private publication");
  assert.equal(p.version.status, "published");
  const [row] = await sql`SELECT public_visibility,first_public_at FROM af_products WHERE id=${f.product.id}`;
  assert.equal(row.public_visibility, "private"); assert.equal(row.first_public_at, null);
});
test("visibility changes require the latest Identity revision and leave an audit actor", async () => {
  const f = await ready(); const [r] = await sql`SELECT identity_revision FROM af_products WHERE id=${f.product.id}`;
  await change(f.product.id, "listed");
  await assert.rejects((await settings()).setProductPublicVisibility(f.product.id, { visibility: "private", expectedRevision: r.identity_revision, reason: "Stale editor" }, "test-editor"), /更新/);
  const [audit] = await sql`SELECT actor FROM audit_log WHERE action='aifind.product.visibility' AND subject=${`aifind:product:${f.product.id}`}`;
  assert.equal(audit.actor, "test-editor");
});
