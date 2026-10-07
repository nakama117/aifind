import { sql } from "@aihot/backend/db";
import { SlugSchema, PublishedListSchema } from "../contracts.ts";
import type { PublishedProduct } from "../contracts.ts";
import { readProducts, publishedDto } from "../catalog/read.ts";
import type { VersionRow } from "../catalog/read.ts";

/** Domain published projection only; this module registers no HTTP/public page in Phase 1. */
export async function getPublishedProductBySlug(slug: string): Promise<PublishedProduct | null> {
  slug = SlugSchema.parse(slug);
  return sql.begin("isolation level repeatable read read only", async tx => {
    const [v] = await tx<VersionRow[]>`SELECT v.* FROM af_product_versions v JOIN af_products p ON p.id=v.product_id
      WHERE p.slug=${slug} AND v.status='published'`;
    return v ? publishedDto((await readProducts(tx, [v]))[0]) : null;
  });
}

export async function listPublishedProducts(input: { limit?: number; offset?: number } = {}): Promise<PublishedProduct[]> {
  const page = PublishedListSchema.parse(input);
  return sql.begin("isolation level repeatable read read only", async tx => {
    const versions = await tx<VersionRow[]>`SELECT v.* FROM af_product_versions v JOIN af_products p ON p.id=v.product_id
      WHERE v.status='published' ORDER BY p.slug, p.id LIMIT ${page.limit} OFFSET ${page.offset}`;
    return (await readProducts(tx, versions)).map(publishedDto);
  });
}
