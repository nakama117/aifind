import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { actorOf } from "@aihot/backend/admin/auth";
import { adminHandler } from "@aihot/api/routes/admin-auth";
import { listHistories, saveHistory, setHistoryEnabled } from "../backend/store.ts";

export function registerChronicleRoutes(app: FastifyInstance) {
  app.get("/api/admin/topic-chronicle", adminHandler(async () => ({ rows: await listHistories() })));
  app.post("/api/admin/topic-chronicle/import", adminHandler(async (req, _reply, admin) => {
    const body = z.strictObject({ document: z.unknown(), reason: z.string().min(1) }).parse(req.body);
    await saveHistory(body.document, actorOf(admin), body.reason);
    return { ok: true };
  }));
  app.post("/api/admin/topic-chronicle/:slug/visibility", adminHandler(async (req, _reply, admin) => {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const body = z.strictObject({ enabled: z.boolean(), reason: z.string().min(1) }).parse(req.body);
    await setHistoryEnabled(slug, body.enabled, actorOf(admin), body.reason);
    return { ok: true };
  }));
}
