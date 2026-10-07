import { sql, type Db, type Tx } from "@aihot/backend/db";
import { newUuid } from "@aihot/backend/lib/ids";
import { AliasSchema, ProductSchema, VendorSchema, VendorUpdateSchema } from "../contracts.ts";
import type { Vendor, ProductIdentity, ProductAlias } from "../contracts.ts";
import { normalizeAlias } from "./normalize.ts";

export interface VendorRow {
  id: string; slug: string; name: string; legal_name: string | null; official_url: string | null;
  country_code: Vendor["countryCode"]; status: Vendor["status"]; created_at: Date; updated_at: Date;
}
export interface IdentityRow {
  id: string; vendor_id: string | null; slug: string; canonical_name: string; created_at: Date; updated_at: Date;
}
export interface AliasRow {
  id: string; product_id: string; alias: string; normalized_alias: string; locale: string | null;
  alias_type: ProductAlias["aliasType"]; created_at: Date;
}
export const vendorDto = (r: VendorRow): Vendor => ({
  id: r.id, slug: r.slug, name: r.name, legalName: r.legal_name, officialUrl: r.official_url,
  countryCode: r.country_code, status: r.status, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
});
export const identityDto = (r: IdentityRow): ProductIdentity => ({
  id: r.id, vendorId: r.vendor_id, slug: r.slug, canonicalName: r.canonical_name,
  createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
});
export const aliasDto = (r: AliasRow): ProductAlias => ({
  id: r.id, productId: r.product_id, alias: r.alias, normalizedAlias: r.normalized_alias, locale: r.locale,
  aliasType: r.alias_type, createdAt: r.created_at.toISOString(),
});

export async function createVendor(input: unknown, db: Db = sql): Promise<Vendor> {
  const v = VendorSchema.parse(input);
  const [r] = await db<VendorRow[]>`INSERT INTO af_vendors (id, slug, name, legal_name, official_url, country_code, status)
    VALUES (${newUuid()}, ${v.slug}, ${v.name}, ${v.legalName ?? null}, ${v.officialUrl ?? null}, ${v.countryCode ?? null}, ${v.status ?? "unknown"}) RETURNING *`;
  return vendorDto(r);
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const [r] = await sql<VendorRow[]>`SELECT id, slug, name, legal_name, official_url, country_code, status, created_at, updated_at FROM af_vendors WHERE id=${id}`;
  return r ? vendorDto(r) : null;
}

export async function updateVendor(id: string, input: unknown, db: Db = sql): Promise<Vendor> {
  const v = VendorUpdateSchema.parse(input);
  const change = Object.fromEntries(Object.entries({ name: v.name, legal_name: v.legalName, official_url: v.officialUrl,
    country_code: v.countryCode, status: v.status }).filter(([, value]) => value !== undefined));
  const [r] = Object.keys(change).length
    ? await db<VendorRow[]>`UPDATE af_vendors SET ${db(change)}, updated_at=greatest(clock_timestamp(), updated_at + interval '1 millisecond') WHERE id=${id} RETURNING *`
    : await db<VendorRow[]>`UPDATE af_vendors SET updated_at=greatest(clock_timestamp(), updated_at + interval '1 millisecond') WHERE id=${id} RETURNING *`;
  if (!r) throw new Error("vendor not found");
  return vendorDto(r);
}

export async function createProduct(input: unknown, db: Db = sql): Promise<ProductIdentity> {
  const p = ProductSchema.parse(input);
  const [r] = await db<IdentityRow[]>`INSERT INTO af_products (id, vendor_id, slug, canonical_name)
    VALUES (${newUuid()}, ${p.vendorId ?? null}, ${p.slug}, ${p.canonicalName}) RETURNING *`;
  return identityDto(r);
}

/** Explicit identity edit; version facts and Vendor URL identity remain separately protected. */
export async function updateProductIdentity(id: string, input: unknown, db: Tx): Promise<ProductIdentity> {
  const p = ProductSchema.parse(input);
  const [previous] = await db`SELECT current_setting('aifind.identity_product', true) AS value`;
  await db`SELECT set_config('aifind.identity_product', ${id}, true)`;
  const [r] = await db<IdentityRow[]>`UPDATE af_products SET canonical_name=${p.canonicalName},
    vendor_id=${p.vendorId ?? null}, slug=${p.slug}, updated_at=clock_timestamp() WHERE id=${id} RETURNING *`;
  await db`SELECT set_config('aifind.identity_product', ${previous.value ?? ""}, true)`;
  if (!r) throw new Error("product not found");
  return identityDto(r);
}

export async function addProductAlias(productId: string, input: unknown, db: Db = sql): Promise<ProductAlias> {
  const a = AliasSchema.parse(input);
  const [r] = await db<AliasRow[]>`INSERT INTO af_product_aliases (id, product_id, alias, normalized_alias, locale, alias_type)
    VALUES (${newUuid()}, ${productId}, ${a.alias}, ${normalizeAlias(a.alias)}, ${a.locale ?? null}, ${a.aliasType}) RETURNING *`;
  return aliasDto(r);
}

export async function listProductAliases(productId: string): Promise<ProductAlias[]> {
  const rows = await sql<AliasRow[]>`SELECT id, product_id, alias, normalized_alias, locale, alias_type, created_at
    FROM af_product_aliases WHERE product_id=${productId} ORDER BY normalized_alias, id`;
  return rows.map(aliasDto);
}
