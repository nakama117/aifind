// Actual SSR and response headers in preview and production, with a local fake API.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const api = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  const pathname = new URL(req.url!, "http://stub").pathname;
  if (pathname === "/api/site/meta") return res.end(JSON.stringify({ changelogVersion: null }));
  if (pathname === "/api/site/aifind/products") return res.end(JSON.stringify({ products: [], limit: 6, offset: 0, hasMore: false }));
  if (pathname === "/api/site/aifind/home") return res.end(JSON.stringify({ products: [], comparisons: [], categories: [], limit: 6, offset: 0, hasMore: false }));
  if (pathname === "/api/site/timeline") return res.end(JSON.stringify({ filters: { channel: "all", category: null, tag: null }, cards: [], nextCursor: null, dayCounts: [], hot: null }));
  if (pathname === "/api/site/pool") return res.end(JSON.stringify({ filters: { channel: "all", category: null, tag: null, q: "test", tab: "latest" }, items: [], total: 0, page: 1, pageSize: 50, pageCount: 1, todayCount: 0, freshness: "2026-10-04T12:00:00.000Z" }));
  if (pathname === "/api/auth/options") return res.end(JSON.stringify({ password: true, feishu: false }));
  res.statusCode = pathname.startsWith("/api/admin/") ? 401 : 404;
  res.end(JSON.stringify({ code: "not_found" }));
});
before(async () => { api.listen(0, "127.0.0.1"); await once(api, "listening"); });
after(() => new Promise<void>((resolve) => api.close(() => resolve())));

for (const preview of [true, false]) test(`SSR metadata and noindex follow preview=${preview}`, async () => {
  let logs = "";
  const web = spawn(process.execPath, [fileURLToPath(new URL("../server.ts", import.meta.url))], {
    env: { ...process.env, WEB_PORT: "0", WEB_HOST: "127.0.0.1", API_BASE_URL: `http://127.0.0.1:${(api.address() as AddressInfo).port}`,
      SITE_URL: "https://news.example.jp", SITE_PREVIEW: String(preview), GOOGLE_SITE_VERIFICATION: "google-public-verification", BING_SITE_VERIFICATION: "BING123", OPENAI_API_KEY: "sk-test-never-serialize-this" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  try {
    const origin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`SSR start timeout: ${logs}`)), 15000);
      web.once("exit", () => { clearTimeout(timer); reject(new Error(`SSR exited: ${logs}`)); });
      web.stderr!.on("data", (chunk) => { logs += String(chunk); });
      web.stdout!.on("data", (chunk) => {
        logs += String(chunk);
        const port = logs.match(/"msg":"web started","port":(\d+)/)?.[1];
        if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }
      });
    });
    const response = await fetch(origin);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /<html lang="ja-JP"/);
    assert.match(html, /rel="canonical" href="https:\/\/news\.example\.jp\/"/);
    assert.match(html, /name="google-site-verification" content="google-public-verification"/);
    assert.match(html, /name="msvalidate.01" content="BING123"/);
    assert.doesNotMatch(html, /sk-test-never-serialize-this|OPENAI_API_KEY/);
    assert.equal(response.headers.get("x-robots-tag"), preview ? "noindex, nofollow" : null);
    assert.equal(/name="robots" content="noindex, nofollow"/.test(html), preview);
    for (const path of ["/admin/login", "/all?q=test"]) {
      const page = await fetch(origin + path);
      assert.equal(page.status, 200, `${path}: ${logs}`);
      assert.match(await page.text(), /name="robots" content="noindex/);
    }
  } finally {
    if (web.exitCode === null) { web.kill("SIGTERM"); await once(web, "exit"); }
  }
});
