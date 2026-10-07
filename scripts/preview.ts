// node --env-file-if-exists=.env scripts/preview.ts --database postgres://postgres@127.0.0.1:55432/aisignal_preview
// Requires a local PostgreSQL server and a built web app. Never starts a collector or worker.
import { spawn, spawnSync } from "node:child_process";
import postgres from "postgres";
import { SITE } from "@aihot/site";
import { assertOnlyPreviewMaterial, previewEnvironment } from "./preview-config.ts";

const at = process.argv.indexOf("--database");
const database = at >= 0 ? process.argv[at + 1] : process.env.DATABASE_URL;
if (!database) throw new Error("Pass --database with a local database name ending in _preview");
const env = previewEnvironment(database, process.env);
const url = new URL(database);
const name = url.pathname.slice(1);
url.pathname = "/postgres";
const admin = postgres(url.toString(), { max: 1 });
try {
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!exists.length) await admin.unsafe(`CREATE DATABASE "${name}"`);
} finally { await admin.end(); }
const target = postgres(database, { max: 1 });
try { await assertOnlyPreviewMaterial(target); }
finally { await target.end(); }
for (const script of ["scripts/migrate.ts", "scripts/seed-preview.ts"]) {
  const result = spawnSync(process.execPath, [script], { env, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const children = ["apps/api/src/main.ts", "apps/web/server.ts"].map((script) =>
  spawn(process.execPath, [script], { env, stdio: "inherit", windowsHide: true }));
let closing = false;
function stop(code: number) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); stop(1); });
  child.on("exit", (code) => stop(code ?? 0));
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
console.log(`${SITE.name} preview: http://127.0.0.1:3100 — official news summaries; collection and model calls disabled.`);
