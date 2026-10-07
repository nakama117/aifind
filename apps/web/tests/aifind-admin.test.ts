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
let productId = "", candidateId = "";
const path = "/admin/aifind/products";

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
  const list = await (await fetch(api + '/api/admin/aifind/products', { headers: { cookie } })).json() as { rows: Array<{ id: string }> };
  productId = list.rows[0].id;
  const detail = await (await fetch(api + '/api/admin/aifind/products/' + productId, { headers: { cookie } })).json() as { published: { version: { id: string }, evidence: Array<{ id: string }> } };
  const created = await fetch(api + '/api/admin/aifind/candidates', { method: 'POST', headers: { cookie, 'x-csrf-token': csrf, 'content-type': 'application/json' },
    body: JSON.stringify({ productId, baseVersionId: detail.published.version.id, candidateType: 'market', targetKey: 'JP',
      proposedValue: { marketCode: 'JP', availabilityStatus: 'restricted', verifiedAt: '2026-10-06T03:00:00Z' }, evidenceId: detail.published.evidence[0].id,
      sourceType: 'manual', reason: 'Synthetic SSR fixture' }) });
  assert.equal(created.status, 200); candidateId = (await created.json() as { id: string }).id;

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

test("A01/A02 all five Admin HTML and independent single-fetch loaders require authentication", async () => {
  for (const url of ["/admin/aifind", path, `${path}/${productId}`, "/admin/aifind/review", `/admin/aifind/review/${candidateId}`]) {
    for (const suffix of ["", ".data"]) {
      const r = await fetch(origin + url + suffix, { redirect: "manual" }); const text = await r.text();
      assert.equal(r.status, suffix ? 202 : 302, url + suffix);
      assert.doesNotMatch(text, /Product Domain Demo|proposedValue|draftRevision/);
      assert.match(r.headers.get("cache-control")!, /no-store/);
    }
  }
});
test("A23/A24 actual Admin/Review pages and Hub are noindex; sitemap and public navigation exclude them", async () => {
  for (const url of ["/admin/aifind", path, `${path}/${productId}`, "/admin/aifind/review", `/admin/aifind/review/${candidateId}`, "/admin/aifind/preview"]) {
    const { response, $ } = await page(url);
    assert.match(response.headers.get("x-robots-tag")!, /noindex/);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    assert.match($('meta[name="robots"]').attr("content")!, /noindex/);
  }
  const { $: hub } = await page("/admin/aifind/preview");
  assert.ok(hub('a[href="/admin/aifind/products"]').length);
  assert.ok(hub('a[href="/admin/aifind/review"]').length);
  assert.doesNotMatch(await (await fetch(origin + "/sitemap.xml")).text(), /admin\/aifind/);
  const home = load(await (await fetch(origin + "/")).text());
  assert.equal(home('a[href^="/admin/aifind"]').length, 0);
});
test("A04 list/dashboard and readonly Published/Edit Draft render real Domain identities and versions", async () => {
  const { $: list } = await page();
  assert.match(list("main").text(), /デモベンダー|Product Domain Demo/);
  assert.ok(list(`a[href="${path}/${productId}"]`).length);
  const { $ } = await page(`${path}/${productId}`);
  assert.match($('[data-version-status="published"]').text(), /Published.*v1/s);
  assert.match($('[data-version-status="draft"]').text(), /Draft.*v2/s);
  assert.equal($('[data-version-status="published"] input, [data-version-status="published"] select').length, 0);
  assert.ok($('[data-draft-editor] select[aria-label="Japanese UI"]').length);
  assert.match($("main").text(), /バージョン履歴|差分/);
  const { $: dashboard } = await page("/admin/aifind"); assert.match(dashboard("main").text(), /Products|Review Queue|Data Health/);
});
test("A12/A13 unknown state choices and free/fixed/from/custom/unknown prices retain distinct semantics", async () => {
  const { $ } = await page(`${path}/${productId}`); const pub = $('[data-version-status="published"]');
  assert.notEqual(pub.find('[data-state="unknown"]').first().attr("class"), pub.find('[data-state="unavailable"]').first().attr("class"));
  assert.equal($('select[aria-label="Platform ios"] option[value="unknown"]').length, 1);
  const values = ["free", "fixed", "custom", "unknown"].map(type => pub.find(`[data-price-type="${type}"]`).text());
  assert.equal(new Set(values).size, 4); assert.doesNotMatch(values[3], /無料|0円/);
  assert.ok($('select[aria-label^="Price type"] option[value="from"]').length);
  assert.equal($('[data-draft-editor] input[type="checkbox"]').length, 0);
});
test("A06/A19 Draft-only data and controlled review values are distinct from the readonly Published area", async () => {
  const { $ } = await page(`${path}/${productId}`);
  assert.doesNotMatch($('[data-version-status="published"]').text(), /下書き専用|draft-only/);
  assert.match($('[data-version-status="draft"]').text(), /下書き専用|下書き/);
  const { $: review } = await page(`/admin/aifind/review/${candidateId}`);
  assert.match(review('[data-current-value]').text(), /available/);
  assert.match(review('[data-proposed-value]').text(), /restricted/);
  assert.match(review("main").text(), /pending_review|manual/);
  assert.ok(review('a[href^="https://preview.example.invalid/"]').length);
  assert.match(review("main").text(), /承認|拒否/);
});
