// Built SSR, real Fastify routes and real Product Domain in a disposable local database.
import assert from "node:assert/strict";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

let web: ChildProcess | undefined;
let apiProcess: ChildProcess | undefined;
let api = "", csrf = "";
let origin = "", cookie = "", logs = "";
const database = new URL(process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:55432/aifind_web_preview_test");
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || !/_(test|ci)$/.test(database.pathname)) {
  throw new Error("Preview SSR tests require a local *_test or *_ci database");
}
const name = `aifind_web_preview_${randomBytes(6).toString("hex")}_test`;
const fixtureFile = fileURLToPath(new URL("../../../modules/aifind/tests/preview-web-fixture.ts", import.meta.url));
const path = "/admin/aifind/preview/product-domain";

before(async () => {
  Object.assign(process.env, { DATABASE_URL: database.toString(), NODE_ENV: "development", AIHOT_ENVIRONMENT: "development",
    SITE_URL: "http://127.0.0.1", AIFIND_PREVIEW_ENABLED: "true", SITE_PREVIEW: "false",
    AIHOT_CREDENTIALS_DIR: "/nonexistent-test-credentials", ADMIN_PASSWORD: "preview-web-test-password",
    SESSION_SECRET: "preview-web-test-session-0123456789", IMG_PROXY_SIGN_SECRET: "preview-web-test-image-0123456789",
    COLLECT_ENABLED: "false", MODEL_CALLS_ENABLED: "false", FEISHU_CONTENT_PUSH_ENABLED: "false",
    FEISHU_INTERNAL_ENABLED: "false", INDEXNOW_SUBMIT_ENABLED: "false", LOG_LEVEL: "error" });
  for (const key of ["DEV_AUTH_ROLE", "DEV_AUTH_DISPLAY_NAME", "OPENAI_API_KEY", "OPENAI_BASE_URL", "FEISHU_LOGIN_APP_ID", "FEISHU_LOGIN_APP_SECRET"]) delete process.env[key];
  await import("../../../tests/setup.ts"); // Loopback-only network guard, no real provider connections.
  apiProcess = spawn(process.execPath, [fixtureFile, "serve", name],
    { env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  api = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`API start timeout: ${logs}`)), 15000);
    apiProcess!.once("exit", () => { clearTimeout(timer); reject(new Error(`API exited: ${logs}`)); });
    apiProcess!.stderr!.on("data", chunk => { logs += String(chunk); });
    apiProcess!.stdout!.on("data", chunk => {
      logs += String(chunk);
      const address = logs.match(/"previewTestApi":"([^"]+)"/)?.[1];
      if (address) { clearTimeout(timer); resolve(address); }
    });
  });
  const logged = await fetch(api + "/api/auth/password", { method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" }, body: "password=preview-web-test-password" });
  assert.equal(logged.status, 303);
  cookie = logged.headers.get("set-cookie")!.split(";")[0];
  csrf = (await (await fetch(api + "/api/admin/me", { headers: { cookie } })).json() as { csrf: string }).csrf;
  const webEnv: NodeJS.ProcessEnv = { ...process.env, WEB_PORT: "0", WEB_HOST: "127.0.0.1", API_BASE_URL: api };
  for (const key of Object.keys(webEnv)) if (/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(key)) delete webEnv[key];
  web = spawn(process.execPath, [fileURLToPath(new URL("../server.ts", import.meta.url))], { env: webEnv,
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  origin = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`SSR start timeout: ${logs}`)), 15000);
    web!.once("exit", () => { clearTimeout(timer); reject(new Error(`SSR exited: ${logs}`)); });
    web!.stderr!.on("data", chunk => { logs += String(chunk); });
    web!.stdout!.on("data", chunk => {
      logs += String(chunk);
      const port = logs.match(/"msg":"web started","port":(\d+)/)?.[1];
      if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }
    });
  });
});
after(async () => {
  if (web && web.exitCode === null) { const exited = once(web, "exit"); web.kill(); await exited; }
  if (apiProcess && apiProcess.exitCode === null) { const exited = once(apiProcess, "exit"); apiProcess.kill(); await exited; }
  execFileSync(process.execPath, [fixtureFile, "cleanup", name], { env: process.env, stdio: "pipe", windowsHide: true });
});
async function page(url = path) {
  const response = await fetch(origin + url, { headers: { cookie }, redirect: "manual" });
  assert.equal(response.status, 200, `${url}: ${logs}`);
  return { response, $: load(await response.text()) };
}

test("unauthenticated Preview HTML and single-fetch never expose either version", async () => {
  for (const url of [path, path + ".data", "/admin/aifind/preview"]) {
    const r = await fetch(origin + url, { redirect: "manual" });
    const body = await r.text();
    if (url.endsWith(".data")) {
      // React Router encodes a 302 redirect in its 202 single-fetch transport.
      assert.equal(r.status, 202);
      assert.match(body, /SingleFetchRedirect/);
      const encoded = JSON.parse(body)[0];
      assert.equal(encoded[0], "SingleFetchRedirect");
      assert.match(body, /"\/api\/auth\/login\?return=%2Fadmin%2Faifind%2Fpreview%2Fproduct-domain\.data"/);
      assert.ok(JSON.parse(body).includes(302));
    } else {
      assert.equal(r.status, 302);
      assert.match(r.headers.get("location")!, /\/api\/auth\/login/);
    }
    assert.match(r.headers.get("cache-control")!, /no-store/);
    assert.doesNotMatch(body, /\[PREVIEW\]|下書き専用|draft-only/);
  }
});
test("Preview page and hub carry noindex/no-store and Preview is absent from sitemap and public navigation", async () => {
  for (const url of [path, "/admin/aifind/preview"]) {
    const { response, $ } = await page(url);
    assert.match(response.headers.get("x-robots-tag")!, /noindex/);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.match($('meta[name="robots"]').attr("content")!, /noindex/);
  }
  const { $: hub } = await page("/admin/aifind/preview");
  assert.equal(hub(`a[href="${path}"]`).length, 1);
  assert.match(hub("main").text(), /Available/);
  assert.doesNotMatch(await (await fetch(origin + "/sitemap.xml")).text(), /admin\/aifind\/preview/);
  const home = load(await (await fetch(origin + "/")).text());
  assert.equal(home('a[href^="/admin/aifind/preview"]').length, 0);
});
test("real Domain snapshots render identity, JP, separate Japanese support, capabilities and evidence verification", async () => {
  const { $ } = await page();
  const pub = $('[data-version-status="published"]');
  assert.match(pub.text(), /\[PREVIEW\] デモベンダー/);
  assert.match(pub.text(), /aifind-preview-product-domain/);
  assert.match(pub.text(), /JP/);
  assert.match(pub.text(), /Input.*対応.*Output.*対応.*UI.*非対応/s);
  assert.match(pub.text(), /text.*coding/s);
  assert.ok(pub.find('a[href="https://preview.example.invalid/pricing"]').length);
  assert.match(pub.text(), /official_pricing/);
  assert.equal(pub.find('[data-field="lastVerifiedAt"] time').attr("datetime"), "2026-10-06T00:00:00.000Z");
  assert.match(pub.find('[data-field="lastVerifiedAt"]').text(), /09:00.*JST/);
  assert.ok(pub.find('[data-field="verifiedAt"] time').length);
});
test("unknown platforms and prices remain distinct from unavailable, free, fixed and custom", async () => {
  const { $ } = await page();
  const pub = $('[data-version-status="published"]');
  const unknown = pub.find('[data-platform="ios"] [data-state="unknown"]');
  const unavailable = pub.find('[data-platform="android"] [data-state="unavailable"]');
  const available = pub.find('[data-platform="web"] [data-state="available"]');
  assert.equal(unknown.text(), "未確認 (unknown)");
  assert.equal(unavailable.text(), "利用不可 (unavailable)");
  assert.equal(available.text(), "利用可能 (available)");
  assert.notEqual(unknown.attr("class"), unavailable.attr("class"));
  const prices = ["unknown", "free", "fixed", "custom"].map(type => pub.find(`[data-price-type="${type}"]`).text());
  assert.equal(new Set(prices).size, 4);
  assert.match(prices[0], /未確認/); assert.doesNotMatch(prices[0], /無料|0円|￥0/);
  assert.match(prices[1], /無料/);
  assert.match(prices[2], /2,000.*月/);
  assert.match(prices[3], /個別見積もり/);
});
test("Published v1 and Draft v2 are marked separately; a real draft edit never appears in Published", async () => {
  const { $: before } = await page();
  const selector = '[data-version-status="published"]';
  const pubBefore = before(selector).text();
  assert.match(pubBefore, /Published.*公開済み.*v1/s);
  assert.match(before('[data-version-status="draft"]').text(), /Draft.*下書き.*v2/s);
  assert.doesNotMatch(pubBefore, /下書き専用|draft-only/);
  const change = await fetch(api + "/api/admin/aifind/preview/product-domain/draft-demo", { method: "POST", headers: { cookie, "x-csrf-token": csrf } });
  assert.equal(change.status, 200);
  const { $: after } = await page();
  assert.equal(after(selector).text(), pubBefore);
  assert.match(after('[data-version-status="draft"]').text(), /下書きの名前を変更済み/);
  assert.doesNotMatch(after(selector).text(), /下書きの名前を変更済み|draft-only/);
});
