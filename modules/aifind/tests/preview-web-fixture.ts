// Backend process used only by built-SSR tests. Every connection is local and the DB is disposable.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { assertPreviewWrites } from "../preview/config.ts";

const [mode, name] = process.argv.slice(2);
assertPreviewWrites(process.env);
if (!/_(test|ci)$/.test(new URL(process.env.DATABASE_URL!).pathname) || !/^aifind_web_preview_[a-f0-9]{12}_test$/.test(name ?? "")) {
  throw new Error("Preview SSR fixture requires a local test database and its unique scoped copy name");
}
const url = new URL(process.env.DATABASE_URL!); url.pathname = "/postgres";
const admin = postgres(url.toString(), { max: 1, onnotice: () => {} });
if (mode === "cleanup") {
  try { await admin`DROP DATABASE IF EXISTS ${admin(name)} WITH (FORCE)`; }
  finally { await admin.end(); }
  process.exit(0);
}
if (mode !== "serve" && mode !== 'serve-detector') throw new Error("Unknown test fixture mode");
try { await admin`CREATE DATABASE ${admin(name)}`; }
finally { await admin.end(); }
url.pathname = `/${name}`; process.env.DATABASE_URL = url.toString();
execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/migrate.ts", import.meta.url))], { env: process.env, stdio: "pipe", windowsHide: true });
await import("../../../tests/setup.ts");
if(mode === 'serve-detector') process.env.MODEL_CALLS_ENABLED = 'false';
const { closeDb } = await import("@aihot/backend/db");
const { installModules } = await import("@aihot/backend/modules");
const { SERVER_MODULES } = await import("@aihot/site/modules/server");
const { buildApp } = await import("../../../apps/api/src/app.ts");
const { seedPreviewProduct } = await import("../preview/seed.ts");

installModules(SERVER_MODULES);
await seedPreviewProduct();
if(mode === 'serve-detector') {
  const { seedDetectorPreview } = await import('../preview/detector-seed.ts');
  await seedDetectorPreview();
  const { getBoss, workModuleQueues } = await import('@aihot/backend/jobs/queue');
  await workModuleQueues(await getBoss());
}
const app = await buildApp();
const origin = await app.listen({ host: "127.0.0.1", port: 0 });
console.log(JSON.stringify({ previewTestApi: origin }));
process.on("SIGTERM", async () => { await app.close(); if(mode === 'serve-detector') await (await import('@aihot/backend/jobs/queue')).stopBoss(); await closeDb(); process.exit(0); });
