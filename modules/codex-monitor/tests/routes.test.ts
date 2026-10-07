import "../../../tests/setup.ts";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import Fastify from "fastify";
import { config } from "@aihot/backend/config";
import { closeDb } from "@aihot/backend/db";

after(closeDb);
test("monitor reads are anonymous and writes require admin plus CSRF", async () => {
  const entry = new URL("../api/routes.ts", import.meta.url);
  assert.ok(existsSync(entry), "the monitor must expose its public and admin routes");
  const { registerMonitorRoutes } = await import(entry.href);
  const app = Fastify();
  registerMonitorRoutes(app);
  const originalCollect = process.env.COLLECT_ENABLED;
  const originalAdmin = config.devAdmin;
  // Keep the public data's collection state fixed while only the principal changes.
  process.env.COLLECT_ENABLED = "false";
  config.devAdmin = null;
  try {
    const anonymous = await app.inject("/api/v1/codex-resets");
    assert.equal(anonymous.statusCode, 200);
    assert.equal(anonymous.json().timezone, "Asia/Tokyo");
    assert.equal(anonymous.json().monitor.status, "unknown");
    assert.equal(anonymous.json().monitor.collectionEnabled, false);
    assert.equal(anonymous.headers["access-control-allow-origin"], "*");
    assert.equal((await app.inject({ url: "/api/v1/codex-resets", headers: { "if-none-match": anonymous.headers.etag! } })).statusCode, 304);
    assert.equal((await app.inject("/api/site/codex-reset?date=2026-02-31")).statusCode, 400);
    assert.equal((await app.inject("/api/admin/monitor")).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/import", payload: {} })).statusCode, 401);
    assert.equal((await app.inject({ method: "PUT", url: "/api/admin/monitor/sources", payload: {} })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/scan", payload: {} })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/documents/missing/review", payload: {} })).statusCode, 401);
    config.devAdmin = { displayName: "Monitor test" };
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/import", payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "PUT", url: "/api/admin/monitor/sources", payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/scan", payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/documents/missing/review", payload: {} })).statusCode, 403);
    assert.equal((await app.inject({ method: "POST", url: "/api/admin/monitor/import", headers: { "x-csrf-token": "dev" }, payload: {} })).statusCode, 400);
    const refresh = await app.inject({ method: "POST", url: "/api/admin/monitor/refresh", headers: { "x-csrf-token": "dev" }, payload: {} });
    assert.equal(refresh.statusCode, 200);
    assert.equal(refresh.json().skipped, true);
    const scan = await app.inject({ method: "POST", url: "/api/admin/monitor/scan", headers: { "x-csrf-token": "dev" }, payload: {} });
    assert.equal(scan.statusCode, 200);
    assert.equal(scan.json().skipped, true, "disabled scan does not queue or perform paid work in the API");
    assert.deepEqual((await app.inject("/api/v1/codex-resets")).json(), anonymous.json(), "admin public projection equals anonymous projection");
  } finally {
    config.devAdmin = originalAdmin;
    if (originalCollect === undefined) delete process.env.COLLECT_ENABLED;
    else process.env.COLLECT_ENABLED = originalCollect;
    await app.close();
  }
});
