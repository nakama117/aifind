import { config } from "@aihot/backend/config";
import { escapeXml } from "@aihot/backend/lib/text";
import { listPublicSitemapProducts } from "./public-products.ts";

export async function productSitemapXml(): Promise<string> {
  const products = await listPublicSitemapProducts();
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${products.map(p =>
    `<url><loc>${escapeXml(`${config.siteUrl}/products/${p.slug}`)}</loc><lastmod>${p.publishedAt}</lastmod></url>`).join("")}</urlset>`;
}
