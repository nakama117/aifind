import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { tag } from "../../../tests/setup.ts";
import { createProduct } from "../catalog/identity.ts";

after(closeDb);
async function domain() {
  assert.ok(existsSync(new URL("../catalog/versions.ts", import.meta.url)), "version domain must exist");
  return import("../catalog/versions.ts");
}
async function product() { return createProduct({ slug: `versions-${tag()}`, canonicalName: "合成製品" }); }
async function publishRow(id: string) {
  await sql`UPDATE af_product_versions SET status='published', published_at='2026-10-04T10:00:00Z' WHERE id=${id}`;
}

test("P04 draft-only product is absent from the published reader", async () => {
  const { createProductDraft, getDraftProduct } = await domain();
  const p = await product();
  await createProductDraft(p.id, { displayName: "未公開の合成製品" }, "private-editor");
  assert.equal((await getDraftProduct(p.id))?.version.displayName, "未公開の合成製品");
  const { getPublishedProductBySlug } = await import("../publication/products.ts");
  assert.equal(await getPublishedProductBySlug(p.slug), null);
});

test("P05 published reader keeps v1 while a cloned v2 draft exists", async () => {
  const { createProductDraft, clonePublishedProduct } = await domain();
  const p = await product();
  const v1 = await createProductDraft(p.id, { displayName: "公開版" });
  await publishRow(v1.version.id);
  const v2 = await clonePublishedProduct(p.id, "private-editor");
  assert.equal(v2.version.versionNo, 2);
  const { getPublishedProductBySlug } = await import("../publication/products.ts");
  const current = await getPublishedProductBySlug(p.slug);
  assert.equal(current?.version.id, v1.version.id);
  assert.equal(current?.version.status, "published");
  assert.equal("createdBy" in current!.version, false);
});

test("P06 editing a cloned draft leaves the published snapshot unchanged", async () => {
  const { createProductDraft, clonePublishedProduct, updateProductDraft, getDraftProduct } = await domain();
  const p = await product();
  const v1 = await createProductDraft(p.id, { displayName: "公開版", officialUrl: "https://synthetic.example/product" });
  await publishRow(v1.version.id);
  const { getPublishedProductBySlug } = await import("../publication/products.ts");
  const before = await getPublishedProductBySlug(p.slug);
  const v2 = await clonePublishedProduct(p.id);
  await updateProductDraft(p.id, v2.version.id, { displayName: "未公開の変更" });
  assert.equal((await getDraftProduct(p.id))?.version.displayName, "未公開の変更");
  assert.deepEqual(await getPublishedProductBySlug(p.slug), before);
});

test("P07 database prevents two current published versions", async () => {
  const { createProductDraft, clonePublishedProduct } = await domain();
  const p = await product();
  const v1 = await createProductDraft(p.id, { displayName: "公開版" });
  await publishRow(v1.version.id);
  const v2 = await clonePublishedProduct(p.id);
  await assert.rejects(publishRow(v2.version.id), { code: "23505" });
});

test("only one draft per product and foreign version edits are rejected", async () => {
  const { createProductDraft, updateProductDraft } = await domain();
  const p = await product();
  const other = await product();
  const v = await createProductDraft(p.id, { displayName: "合成草稿" });
  await assert.rejects(createProductDraft(p.id, { displayName: "重複草稿" }), /draft/);
  await assert.rejects(sql`INSERT INTO af_product_versions (id, product_id, version_no, display_name) VALUES (${tag()}, ${p.id}, 2, 'duplicate')`, { code: "23505" });
  await assert.rejects(updateProductDraft(other.id, v.version.id, { displayName: "誤った所有者" }), /belong/);
});

test("published version cannot be edited through domain or direct SQL", async () => {
  const { createProductDraft, updateProductDraft } = await domain();
  const p = await product();
  const v = await createProductDraft(p.id, { displayName: "公開版" });
  await publishRow(v.version.id);
  await assert.rejects(updateProductDraft(p.id, v.version.id, { displayName: "overwrite" }), /draft/);
  await assert.rejects(sql`UPDATE af_product_versions SET display_name='overwrite' WHERE id=${v.version.id}`, /immutable/);
  await assert.rejects(sql`DELETE FROM af_product_versions WHERE id=${v.version.id}`, /immutable/);
});
