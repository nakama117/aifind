import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql,closeDb } from "@aihot/backend/db";
import { updateProductDraft, getDraftProduct } from "../catalog/versions.ts";
after(closeDb);
const seed = async () => (await import("../preview/public-seed.ts")).seedPublicPreview();
test("public Preview seed is opt-in, rejects production even with flag, and importing it never writes", async () => {
  const before = (await sql`SELECT count(*) AS n FROM af_products`)[0].n;
  const original = { flag:process.env.AIFIND_PREVIEW_ENABLED, node:process.env.NODE_ENV };
  try {
    process.env.AIFIND_PREVIEW_ENABLED="false";
    await import("../preview/public-seed.ts");
    await assert.rejects(seed(), /AIFIND_PREVIEW_ENABLED/);
    process.env.AIFIND_PREVIEW_ENABLED="true"; process.env.NODE_ENV="production";
    await assert.rejects(seed(), /production/);
    assert.equal((await sql`SELECT count(*) AS n FROM af_products`)[0].n,before);
  } finally { process.env.AIFIND_PREVIEW_ENABLED=original.flag; process.env.NODE_ENV=original.node; }
});
test("public Preview seed creates listed/unlisted/private/history fixtures and preserves later Draft edits", async () => {
  const previous=process.env.AIFIND_PREVIEW_ENABLED; process.env.AIFIND_PREVIEW_ENABLED="true";
  try {
    const f=await seed();
    const rows=await sql`SELECT slug,public_visibility,canonical_name FROM af_products WHERE id IN ${sql(Object.values(f))}`;
    assert.equal(rows.length,4); assert.ok(rows.every(r=>r.canonical_name.startsWith('[PREVIEW]')));
    assert.equal(rows.filter(r=>r.public_visibility==='listed').length,2);
    assert.equal(rows.filter(r=>r.public_visibility==='unlisted').length,1);
    assert.equal(rows.filter(r=>r.public_visibility==='private').length,1);
    const draft=(await getDraftProduct(f.aId))!; await updateProductDraft(f.aId,draft.version.id,{summaryJa:"後から保存した下書き"});
    assert.deepEqual(await seed(),f); assert.equal((await getDraftProduct(f.aId))!.version.summaryJa,"後から保存した下書き");
    assert.equal((await sql`SELECT 1 FROM af_product_slug_redirects WHERE product_id=${f.dId}`).length,2);
  } finally {process.env.AIFIND_PREVIEW_ENABLED=previous;}
});
