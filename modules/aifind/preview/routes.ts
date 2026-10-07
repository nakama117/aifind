import type { FastifyInstance } from "fastify";
import { adminHandler } from "@aihot/api/routes/admin-auth";
import type { AdminHandler } from "@aihot/api/routes/admin-auth";
import { canWritePreview, changePreviewDraftName, readProductDomainPreview } from "./service.ts";
import { previewEnabled } from "./config.ts";
import type { PreviewHub } from "./contracts.ts";
import { resolvePublicProductBySlug } from "../publication/public-products.ts";
import {z} from 'zod';
import {readDiscoveryPreview} from './discovery-service.ts';
import {bootstrapPack} from './discovery-pack.ts';
import {inspectCatalogPack,importCatalogPack} from '../catalog-pack/import.ts';
import {readEditorialPreview} from './editorial-service.ts';
import {readGuidePreview} from './guide-service.ts';

function previewHandler(fn: AdminHandler) {
  const guarded = adminHandler(async (req, reply, admin) => {
    if (!previewEnabled()) return reply.code(404).send({ code: "not_found" });
    return fn(req, reply, admin);
  });
  return async (...args: Parameters<typeof guarded>) => {
    args[1].header("X-Robots-Tag", "noindex, nofollow");
    return guarded(...args);
  };
}
export function registerPreviewRoutes(app: FastifyInstance): void {
  app.get("/api/admin/aifind/preview", async(req,reply)=>{reply.header('X-Robots-Tag','noindex, nofollow');return adminHandler(async (): Promise<PreviewHub> => ({ previews: [
    { title: "Phase 1 Product Domain Preview", path: "/admin/aifind/preview/product-domain", status: "Available" },
    { title: "Phase 2 Product Admin", path: "/admin/aifind/products", status: "Available" },
    { title: "Phase 2 Review Queue", path: "/admin/aifind/review", status: "Available" },
    { title: "Phase 3 Public Product Directory", path: "/products", status: "Available" },
    { title: "Phase 4 Product Resolver + Change Detector", path: "/admin/aifind/preview/change-detector", status: "Available" },
    { title: "Phase 5 Product Discovery + Catalog Bootstrap", path: "/admin/aifind/preview/product-discovery", status: "Available" },
    { title: "Phase 6 Editorial + Compare / Category", path: "/admin/aifind/preview/compare-category", status: "Available" },
    { title: "Phase 7 How-to / Guide + Media", path: "/admin/aifind/preview/howto-guide", status: "Available" },
    { title: "Phase 8 Launch Readiness + Real Content", path: "/admin/aifind/preview/launch-readiness", status: "Available" },
    ...((await resolvePublicProductBySlug("aifind-preview-public-a")).kind === "found" ? [{ title: "Phase 3 Public Product Detail", path: "/products/aifind-preview-public-a", status: "Available" as const }] : []),
  ].map(p=>({...p,status:!previewEnabled()&&p.path.startsWith('/admin/aifind/preview/')&&!p.path.endsWith('/launch-readiness')?'Disabled':'Available'})) }))(req,reply);});
  app.get("/api/admin/aifind/preview/product-domain", previewHandler(async () => readProductDomainPreview()));
  app.get('/api/admin/aifind/preview/product-discovery',previewHandler(async()=>readDiscoveryPreview()));
  app.get('/api/admin/aifind/preview/compare-category',previewHandler(async()=>readEditorialPreview()));
  app.get('/api/admin/aifind/preview/howto-guide',previewHandler(async()=>readGuidePreview()));
  app.post('/api/admin/aifind/preview/product-discovery/pack',previewHandler(async(req,reply,admin)=>{
    if(!canWritePreview())return reply.code(403).send({code:'forbidden',detail:'Local disposable Preview database required.'});
    const body=z.strictObject({action:z.enum(['dry-run','import']),example:z.enum(['valid','missing-evidence','bad-money','existing-conflict'])}).parse(req.body);
    if(body.action==='import'&&body.example!=='valid')return reply.code(400).send({code:'invalid_request'});
    const pack=bootstrapPack(body.example);
    return body.action==='dry-run'?inspectCatalogPack(pack):importCatalogPack(pack,admin.name);
  }));
  app.post("/api/admin/aifind/preview/product-domain/draft-demo", previewHandler(async (_req, reply) => {
    if (!canWritePreview()) return reply.code(403).send({ code: "forbidden", detail: "Preview demo writes require a local non-production preview/test database." });
    await changePreviewDraftName();
    return { ok: true };
  }));
}
