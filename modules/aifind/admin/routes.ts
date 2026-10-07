import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { adminHandler } from "@aihot/api/routes/admin-auth";
import type { AdminHandler } from "@aihot/api/routes/admin-auth";
import { sendProblem } from "@aihot/api/http/respond";
import { readDashboard, listAdminProducts, readAdminProduct, lookupAdminVendors, lookupAdminEvidence } from "./read.ts";
import { createAdminProduct, updateAdminIdentity, addAdminAlias, createAdminDraft, saveAdminDraft, publishAdminDraft,
  createAdminVendor, updateAdminVendor, addAdminEvidence } from "./products.ts";
import { createCandidate, listCandidates, readCandidate, reviewCandidate } from "../changes/candidates.ts";
import { applyCandidate } from "../changes/apply.ts";
import { NotFound, PublishValidation } from "./errors.ts";
import { setProductPublicVisibility, PublicReadinessError } from "../catalog/public-settings.ts";

const ids = z.record(z.string(), z.string().min(1).max(80));
const params = (req: FastifyRequest) => ids.parse(req.params);
export function handler(fn: AdminHandler) {
  const guarded = adminHandler(async (req, reply, admin) => {
    try { return await fn(req, reply, admin); }
    catch (error) {
      if (error instanceof NotFound) return sendProblem(req, reply, { status: 404, code: "not_found", detail: error.message });
      if (error instanceof PublishValidation) return sendProblem(req, reply, { status: 422, code: "publication_validation", title: "Publication validation", detail: error.message });
      if (error instanceof PublicReadinessError) return sendProblem(req, reply, { status: 422, code: "public_readiness", title: "Public readiness", detail: error.message });
      throw error;
    }
  });
  return async (...args: Parameters<typeof guarded>) => {
    args[1].header("X-Robots-Tag", "noindex, nofollow");
    return guarded(...args);
  };
}
export function registerAdminRoutes(app: FastifyInstance): void {
  const prefix = "/api/admin/aifind";
  app.get(prefix + "/dashboard", handler(async () => readDashboard()));
  app.get(prefix + "/products", handler(async req => listAdminProducts(req.query)));
  app.post(prefix + "/products", handler(async (req, _reply, admin) => createAdminProduct(req.body, admin.name)));
  app.get(prefix + "/products/:id", handler(async req => readAdminProduct(params(req).id)));
  app.patch(prefix + "/products/:id/identity", handler(async (req, _reply, admin) => updateAdminIdentity(params(req).id, req.body, admin.name)));
  app.patch(prefix + "/products/:id/public-settings", handler(async (req, _reply, admin) => setProductPublicVisibility(params(req).id, req.body, admin.name)));
  app.post(prefix + "/products/:id/aliases", handler(async (req, _reply, admin) => addAdminAlias(params(req).id, req.body, admin.name)));
  app.post(prefix + "/products/:id/draft", handler(async (req, _reply, admin) => createAdminDraft(params(req).id, req.body, admin.name)));
  app.patch(prefix + "/products/:id/draft/:versionId", handler(async (req, _reply, admin) => {
    const { id, versionId } = params(req); return saveAdminDraft(id, versionId, req.body, admin.name);
  }));
  app.post(prefix + "/products/:id/draft/:versionId/publish", handler(async (req, _reply, admin) => {
    const { id, versionId } = params(req); return publishAdminDraft(id, versionId, req.body, admin.name);
  }));
  app.get(prefix + "/vendors", handler(async req => lookupAdminVendors(req.query)));
  app.post(prefix + "/vendors", handler(async (req, _reply, admin) => createAdminVendor(req.body, admin.name)));
  app.patch(prefix + "/vendors/:id", handler(async (req, _reply, admin) => updateAdminVendor(params(req).id, req.body, admin.name)));
  app.get(prefix + "/evidence", handler(async req => lookupAdminEvidence(req.query)));
  app.post(prefix + "/evidence", handler(async (req, _reply, admin) => addAdminEvidence(req.body, admin.name)));
  app.get(prefix + "/candidates", handler(async req => listCandidates(req.query)));
  app.post(prefix + "/candidates", handler(async (req, _reply, admin) => createCandidate(req.body, admin.name)));
  app.get(prefix + "/candidates/:id", handler(async req => readCandidate(params(req).id)));
  app.post(prefix + "/candidates/:id/approve", handler(async (req, _reply, admin) => reviewCandidate(params(req).id, "approve", req.body, admin.name)));
  app.post(prefix + "/candidates/:id/reject", handler(async (req, _reply, admin) => reviewCandidate(params(req).id, "reject", req.body, admin.name)));
  app.post(prefix + "/candidates/:id/apply", handler(async (req, _reply, admin) => applyCandidate(params(req).id, req.body, admin.name)));
}
