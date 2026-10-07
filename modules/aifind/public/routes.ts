import type { FastifyInstance } from "fastify";
import {DiscoveryQuerySchema} from '../discovery/contracts.ts';
import { renderOg } from "@aihot/api/og/render";
import { listPublicProducts, resolvePublicProductBySlug } from "../publication/public-products.ts";
import { productSitemapXml } from "../publication/sitemap.ts";

export function registerPublicRoutes(app: FastifyInstance): void {
  const fresh = { "Cache-Control": "no-store", "X-Accel-Expires": "0" };
  app.get("/api/site/aifind/products", async (req,reply) => {
    reply.headers(fresh); const parsed = DiscoveryQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ code: "invalid_query" });
    return listPublicProducts(parsed.data);
  });
  app.get("/api/site/aifind/products/:slug", async (req,reply) => {
    reply.headers(fresh); const r = await resolvePublicProductBySlug((req.params as {slug:string}).slug);
    if (r.kind === "not_found") return reply.code(404).send(r);
    if (r.kind === "found" && r.product.visibility === "unlisted") reply.header("X-Robots-Tag","noindex,follow");
    return r;
  });
  app.get("/sitemap-products.xml", async (_req,reply) => reply.headers(fresh).type("application/xml; charset=utf-8").send(await productSitemapXml()));
  app.get("/og/products/:file", async (req,reply) => {
    reply.headers(fresh); const file = (req.params as {file:string}).file;
    if (!file.endsWith(".png")) return reply.code(404).send("Not found");
    const r = await resolvePublicProductBySlug(file.slice(0,-4));
    if (r.kind === "not_found") return reply.code(404).send("Not found");
    if (r.kind === "redirect") return reply.code(301).header("Location",`/og/products/${r.slug}.png`).send();
    if (r.product.visibility === "unlisted") reply.header("X-Robots-Tag","noindex,follow");
    const p = r.product;
    return reply.type("image/png").send((await renderOg({ kicker:"AIを探す", title:p.displayName, subtitle:p.summaryJa, meta:p.vendor?.name ?? undefined })).png);
  });
}
