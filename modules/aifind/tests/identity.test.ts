import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { tag } from "../../../tests/setup.ts";

after(closeDb);
async function domain() {
  const file = new URL("../catalog/identity.ts", import.meta.url);
  assert.ok(existsSync(file), "product identity domain must exist");
  return import("../catalog/identity.ts");
}

test("P01 vendor slug is unique and display-name edits keep its stable slug", async () => {
  const { createVendor, updateVendor, getVendor } = await domain();
  const slug = `vendor-${tag()}`;
  const vendor = await createVendor({ slug, name: "合成提供元", legalName: "Synthetic Ltd", countryCode: "JP" });
  await assert.rejects(createVendor({ slug, name: "別の提供元" }), { code: "23505" });
  await updateVendor(vendor.id, { name: "変更した表示名" });
  const updated = await getVendor(vendor.id);
  assert.equal(updated?.slug, slug);
  assert.equal(updated?.name, "変更した表示名");
  await assert.rejects(sql`UPDATE af_vendors SET slug='renamed' WHERE id=${vendor.id}`, /slug/);
});

test("P02 product slug is globally unique across vendors", async () => {
  const { createVendor, createProduct } = await domain();
  const a = await createVendor({ slug: `a-${tag()}`, name: "Synthetic A" });
  const b = await createVendor({ slug: `b-${tag()}`, name: "Synthetic B" });
  const slug = `product-${tag()}`;
  const product = await createProduct({ slug, canonicalName: "合成製品", vendorId: a.id });
  assert.equal(product.vendorId, a.id);
  await assert.rejects(createProduct({ slug, canonicalName: "別の製品", vendorId: b.id }), { code: "23505" });
  await assert.rejects(sql`UPDATE af_products SET slug='renamed' WHERE id=${product.id}`, /slug/);
});

test("P03 aliases normalize width, case and whitespace without losing the display text", async () => {
  const { createProduct, addProductAlias, listProductAliases } = await domain();
  const product = await createProduct({ slug: `aliases-${tag()}`, canonicalName: "Synthetic Code" });
  const display = " Ｃｌａｕｄｅ　ＣＯＤＥ ";
  await addProductAlias(product.id, { alias: display, aliasType: "former_name", locale: "ja-JP" });
  await addProductAlias(product.id, { alias: "クロード コード", aliasType: "common", locale: "ja-JP" });
  const aliases = await listProductAliases(product.id);
  assert.equal(aliases.find(a => a.alias === display)?.normalizedAlias, "claude code");
  assert.equal(aliases.find(a => a.alias === "クロード コード")?.normalizedAlias, "クロード コード");
  await assert.rejects(addProductAlias(product.id, { alias: "CLAUDE CODE", aliasType: "common" }), { code: "23505" });
  const { normalizeAlias } = await import("../catalog/normalize.ts");
  for (const [input, expected] of [[" \t ChatGPT  Plus\n", "chatgpt plus"], ["ＡＩ", "ai"], ["カタカナ", "カタカナ"]]) {
    assert.equal(normalizeAlias(input), expected);
    assert.equal(normalizeAlias(expected), expected);
  }
});

test("identity validation rejects empty or path slugs, unsupported codes and unsafe URL schemes", async () => {
  const { createVendor, createProduct, addProductAlias } = await domain();
  for (const slug of ["", "a/b", "AIFIND", "two--hyphens", "../escape"]) {
    await assert.rejects(createProduct({ slug, canonicalName: "Synthetic" }));
  }
  await assert.rejects(createVendor({ slug: `bad-${tag()}`, name: "Synthetic", officialUrl: "javascript:alert(1)" }));
  await assert.rejects(createVendor({ slug: `bad-${tag()}`, name: "Synthetic", countryCode: "garbage" }));
  const p = await createProduct({ slug: `empty-${tag()}`, canonicalName: "Synthetic" });
  await assert.rejects(addProductAlias(p.id, { alias: "　\n", aliasType: "common" }));
});

test("alias ambiguity may exist across products without joining news entities", async () => {
  const { createProduct, addProductAlias, listProductAliases } = await domain();
  const a = await createProduct({ slug: `one-${tag()}`, canonicalName: "Synthetic A" });
  const b = await createProduct({ slug: `two-${tag()}`, canonicalName: "Synthetic B" });
  for (const p of [a, b]) await addProductAlias(p.id, { alias: "Copilot", aliasType: "brand" });
  assert.equal((await listProductAliases(a.id))[0].productId, a.id);
  assert.equal((await listProductAliases(b.id))[0].productId, b.id);
  await assert.rejects(addProductAlias("missing-product", { alias: "Orphan", aliasType: "common" }), { code: "23503" });
});
