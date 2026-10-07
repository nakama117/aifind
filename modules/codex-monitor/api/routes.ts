import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { adminHandler } from "@aihot/api/routes/admin-auth";
import { applyPublicHeaders, QueryError, sendJsonWithEtag, sendProblem, strictQuery } from "@aihot/api/http/respond";
import { actorOf } from "@aihot/backend/admin/auth";
import { audit } from "@aihot/backend/audit";
import { importAnnouncements, listAdminMonitor, updateEvent } from "../backend/admin.ts";
import { loadMonitorPage, loadMonitorSnapshot, loadMonitorVersion, loadRecentMonitor } from "../backend/publication.ts";
import { refreshOfficialStatus } from "../backend/refresh.ts";
import { DateSchema } from "../backend/schema.ts";
import { saveCollectionSettings, reviewDocument } from "../backend/collection-admin.ts";
import { enqueueOn } from "@aihot/backend/jobs/queue";
import { announcementQueue } from "../backend/jobs.ts";
import { collectionEnabled } from "../backend/collection-schema.ts";

export function registerMonitorRoutes(app: FastifyInstance) {
  const read = (reader: (req: FastifyRequest) => Promise<unknown>) => async (req: FastifyRequest, reply: FastifyReply) => {
    applyPublicHeaders(reply);
    try { return sendJsonWithEtag(req, reply, await reader(req), { etagPrefix: "codex-jp", cacheControl: "no-cache" }); }
    catch (error) {
      if (error instanceof ZodError || error instanceof QueryError) return sendProblem(req, reply, { status: 400, code: "invalid_request", detail: "Use a valid date (YYYY-MM-DD)." });
      throw error;
    }
  };
  app.get("/api/v1/codex-resets", read(async (req) => { strictQuery(req, []); return loadMonitorSnapshot(); }));
  app.get("/api/v1/codex-resets/recent", read(async (req) => { strictQuery(req, []); return loadRecentMonitor(); }));
  app.get("/api/v1/codex-resets/version", read(async (req) => { strictQuery(req, []); return loadMonitorVersion(); }));
  app.get("/api/site/codex-reset", read(async (req) => {
    const { date } = strictQuery(req, ["date"]);
    return loadMonitorPage(date === undefined ? undefined : DateSchema.parse(date));
  }));
  app.get("/api/site/codex-reset/day", read(async (req) => {
    const { date } = strictQuery(req, ["date"]);
    const page = await loadMonitorPage(DateSchema.parse(date));
    return { date: page.selectedDate, version: page.version, events: page.dayEvents };
  }));
  app.get("/api/site/codex-reset/version", read(async (req) => { strictQuery(req, []); return loadMonitorVersion(); }));
  app.get("/api/admin/monitor", adminHandler(async () => listAdminMonitor()));
  app.put("/api/admin/monitor/sources", adminHandler(async (req, _reply, admin) => saveCollectionSettings(req.body, actorOf(admin))));
  app.post("/api/admin/monitor/scan", adminHandler(async (_req, _reply, admin) => {
    if (!collectionEnabled()) return { skipped: true, reason: "collection_disabled" };
    const jobId = await enqueueOn(announcementQueue, {}, { singletonKey: "scan" });
    await audit(actorOf(admin), "codex-monitor.queue-scan", "codex-monitor:sources", null, null, { jobId });
    return { skipped: false, queued: !!jobId, jobId };
  }));
  app.post("/api/admin/monitor/documents/:id/review", adminHandler(async (req, reply, admin) => {
    const result = await reviewDocument((req.params as { id: string }).id, req.body, actorOf(admin));
    return result ?? sendProblem(req, reply, { status: 404, code: "not_found", detail: "来源修订不存在" });
  }));
  app.post("/api/admin/monitor/import", adminHandler(async (req, _reply, admin) => importAnnouncements(req.body, actorOf(admin))));
  app.patch("/api/admin/monitor/events/:id", adminHandler(async (req, reply, admin) => {
    const result = await updateEvent((req.params as { id: string }).id, req.body, actorOf(admin));
    return result ?? sendProblem(req, reply, { status: 404, code: "not_found", detail: "事件不存在" });
  }));
  app.post("/api/admin/monitor/refresh", adminHandler(async (_req, _reply, admin) => {
    const result = await refreshOfficialStatus();
    await audit(actorOf(admin), "codex-monitor.refresh", "codex-monitor:status", null, null, result);
    return result;
  }));
}
