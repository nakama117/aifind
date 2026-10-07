import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { newUuid } from "@aihot/backend/lib/ids";
import { tag } from "../../../tests/setup.ts";
import { createProduct, updateProductIdentity } from "../catalog/identity.ts";
import { publicFixture, visibilityChange } from "./public-fixtures.ts";
after(closeDb);
const name = () => `slug-test-${tag()}`;
async function rename(f: Awaited<ReturnType<typeof publicFixture>>, slug: string) {
  return sql.begin(tx => updateProductIdentity(f.product.id, { canonicalName: f.product.canonicalName, vendorId: f.vendor.id, slug }, tx));
}
test("never-public slug edits create no redirect; first public date is the history threshold", async () => {
  const f = await publicFixture("private"); await rename(f, name());
  assert.equal((await sql`SELECT 1 FROM af_product_slug_redirects WHERE product_id=${f.product.id}`).length, 0);
});
test("W10 all historical slugs retain product identity across multiple changes and withdrawal", async () => {
  const f = await publicFixture(); const b = name(), c = name();
  await rename(f, b); await visibilityChange(f.product.id, "private"); await rename(f, c);
  const rows = await sql`SELECT old_slug,product_id FROM af_product_slug_redirects WHERE product_id=${f.product.id} ORDER BY old_slug`;
  assert.deepEqual(rows.map(r => r.old_slug).sort(), [f.product.slug, b].sort());
  assert.ok(rows.every(r => r.product_id === f.product.id));
  const [current] = await sql`SELECT slug FROM af_products WHERE id=${rows[0].product_id}`;
  assert.equal(current.slug, c);
  await assert.rejects(sql`DELETE FROM af_product_slug_redirects WHERE product_id=${f.product.id}`, /immutable/);
});
test("W11 a historical slug cannot be reused as another product's current slug", async () => {
  const f = await publicFixture(); await rename(f, name());
  await assert.rejects(createProduct({ slug: f.product.slug, canonicalName: "Another product" }), /reserved/);
  const other = await publicFixture("private"); await assert.rejects(rename(other, f.product.slug), /reserved/);
});
test("current slug cannot be claimed by a historical record", async () => {
  const a = await publicFixture(), b = await publicFixture("private");
  await assert.rejects(sql`INSERT INTO af_product_slug_redirects(id,product_id,old_slug) VALUES (${newUuid()},${b.product.id},${a.product.slug})`, /reserved/);
});
test("concurrent current/history claims serialize: exactly one claims a new slug", async () => {
  const f = await publicFixture(), slug = name();
  const r = await Promise.allSettled([
    createProduct({ slug, canonicalName: "Race current" }),
    sql`INSERT INTO af_product_slug_redirects(id,product_id,old_slug) VALUES (${newUuid()},${f.product.id},${slug})`,
  ]);
  assert.equal(r.filter(v => v.status === "fulfilled").length, 1);
  assert.equal((await sql`SELECT slug FROM af_products WHERE slug=${slug}`).length + (await sql`SELECT old_slug FROM af_product_slug_redirects WHERE old_slug=${slug}`).length, 1);
});

test("stale Repeatable Read current claim cannot miss a subsequently committed historical slug", async () => {
  const f = await publicFixture(), slug = name();
  await assert.rejects(sql.begin("isolation level repeatable read", async tx => {
    await tx`SELECT id FROM af_products WHERE id=${f.product.id}`;
    await sql`INSERT INTO af_product_slug_redirects(id,product_id,old_slug) VALUES (${newUuid()},${f.product.id},${slug})`;
    await createProduct({ slug, canonicalName: "Stale current claimant" }, tx);
  }), { code: "25000" });
  assert.equal((await sql`SELECT 1 FROM af_products WHERE slug=${slug}`).length, 0);
  assert.equal((await sql`SELECT 1 FROM af_product_slug_redirects WHERE old_slug=${slug}`).length, 1);
});

test("stale Repeatable Read history claim cannot miss a subsequently committed current slug", async () => {
  const f = await publicFixture(), slug = name();
  await assert.rejects(sql.begin("isolation level repeatable read", async tx => {
    await tx`SELECT id FROM af_products WHERE id=${f.product.id}`;
    await createProduct({ slug, canonicalName: "Committed current claimant" });
    await tx`INSERT INTO af_product_slug_redirects(id,product_id,old_slug) VALUES (${newUuid()},${f.product.id},${slug})`;
  }), { code: "25000" });
  assert.equal((await sql`SELECT 1 FROM af_products WHERE slug=${slug}`).length, 1);
  assert.equal((await sql`SELECT 1 FROM af_product_slug_redirects WHERE old_slug=${slug}`).length, 0);
});

test("Serializable slug claims are rejected while public snapshot reads remain supported", async () => {
  await assert.rejects(sql.begin("isolation level serializable", tx => createProduct({ slug: name(), canonicalName: "Unsupported claim isolation" }, tx)), { code: "25000" });
  await sql.begin("isolation level repeatable read read only", async tx => { await tx`SELECT slug FROM af_products LIMIT 1`; });
});
