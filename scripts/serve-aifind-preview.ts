// Serve already-seeded disposable local data. Phase 4 may start its own synthetic-only queues.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPreviewWrites } from "../modules/aifind/preview/config.ts";

assertPreviewWrites(process.env);
if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_preview")) throw new Error("Browser Preview server requires a dedicated *_preview database");
const root = fileURLToPath(new URL("..", import.meta.url));
if (!existsSync(path.join(root, "apps/web/build/server/index.js"))) throw new Error("Build @aihot/web before serving Preview");
const webPort = Number(process.env.WEB_PORT ?? 3200), apiPort = Number(process.env.API_PORT ?? 3201);
if (![webPort, apiPort].every(p => Number.isInteger(p) && p > 1024 && p < 65536) || webPort === apiPort) throw new Error("Distinct local ports are required");
const adminPreview = process.env.AIFIND_PREVIEW_RUNTIME === "admin";
const publicPreview = process.env.AIFIND_PREVIEW_RUNTIME === "public";
const detectorPreview = process.env.AIFIND_PREVIEW_RUNTIME === 'detector';
const discoveryPreview = process.env.AIFIND_PREVIEW_RUNTIME === 'discovery';
const editorialPreview = process.env.AIFIND_PREVIEW_RUNTIME === 'editorial';
const guidePreview = process.env.AIFIND_PREVIEW_RUNTIME === 'guide';
const previewPath = guidePreview ? '/admin/aifind/preview/howto-guide' : editorialPreview ? '/admin/aifind/preview/compare-category' : discoveryPreview ? '/admin/aifind/preview/product-discovery' : detectorPreview ? '/admin/aifind/preview/change-detector' : publicPreview ? "/products" : adminPreview ? "/admin/aifind" : "/admin/aifind/preview/product-domain";
const output = path.join(root, guidePreview ? '.data/aifind-guide-preview' : editorialPreview ? '.data/aifind-editorial-preview' : discoveryPreview ? '.data/aifind-discovery-preview' : detectorPreview ? '.data/aifind-detector-preview' : publicPreview ? ".data/aifind-public-preview" : adminPreview ? ".data/aifind-admin-preview" : ".data/aifind-product-preview");
mkdirSync(output, { recursive: true });
const password = randomBytes(18).toString("base64url");
const passwordFile = path.join(output, "login.txt");
writeFileSync(passwordFile, `Local AIFIND Preview only\nURL: http://localhost:${webPort}${previewPath}\nPassword: ${password}\n`, { mode: 0o600 });
const inherited = { ...process.env };
for (const key of Object.keys(inherited)) {
  if (/API_KEY|PASSWORD|SECRET|TOKEN|EGRESS_PROXY_URL/.test(key) || key.startsWith("FEISHU_") || key.startsWith("DEV_AUTH_")) delete inherited[key];
}
const env: NodeJS.ProcessEnv = { ...inherited, DATABASE_URL: process.env.DATABASE_URL!, NODE_ENV: "development", AIHOT_ENVIRONMENT: "preview",
  SITE_URL: `http://localhost:${webPort}`, API_BASE_URL: `http://127.0.0.1:${apiPort}`, WEB_HOST: "127.0.0.1", API_HOST: "127.0.0.1",
  WEB_PORT: String(webPort), API_PORT: String(apiPort), SITE_PREVIEW: discoveryPreview || editorialPreview || guidePreview ? "false" : "true", AIFIND_PREVIEW_ENABLED: "true",
  AIHOT_CREDENTIALS_DIR: path.join(output, "no-credentials"), AIHOT_DATA_DIR: output,
  ADMIN_PASSWORD: password, SESSION_SECRET: randomBytes(32).toString("hex"), IMG_PROXY_SIGN_SECRET: randomBytes(32).toString("hex"),
  COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false", AIFIND_DETECTOR_ENABLED: 'false', FEISHU_CONTENT_PUSH_ENABLED: "false", FEISHU_INTERNAL_ENABLED: "false",
  INDEXNOW_SUBMIT_ENABLED: "false", ALLOW_PRIVATE_NETWORK_FETCH: "false", TRUST_PROXY: "false" };
const webEnv = { ...env };
for (const key of Object.keys(webEnv)) if (/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(key)) delete webEnv[key];
const api = spawn(process.execPath, [path.join(root, "apps/api/src/main.ts")], { cwd: root, env, stdio: "inherit", windowsHide: true });
const web = spawn(process.execPath, [path.join(root, "apps/web/server.ts")], { cwd: root, env: webEnv, stdio: "inherit", windowsHide: true });
const worker = detectorPreview ? spawn(process.execPath, [path.join(root,'scripts/worker-aifind-detector-preview.ts')], {cwd:root,env,stdio:'inherit',windowsHide:true}) : undefined;
writeFileSync(path.join(output, "runtime.json"), JSON.stringify({ launcher: process.pid, api: api.pid, web: web.pid,
  worker: worker?.pid, database: new URL(env.DATABASE_URL!).pathname, url: env.SITE_URL, seedOnStartup: false,
  externalActions: false, startedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ preview: `${env.SITE_URL}${previewPath}`, passwordFile, seedOnStartup: false }));
let stopping = false;
function stop() { if (stopping) return; stopping = true; api.kill(); web.kill(); worker?.kill(); }
for (const child of [api, web, ...(worker ? [worker] : [])]) {
  child.once("error", error => { console.error(error.message); process.exitCode = 1; stop(); });
  child.once("exit", code => { if (!stopping) { process.exitCode = code ?? 1; stop(); } });
}
process.on("SIGTERM", stop); process.on("SIGINT", stop);
