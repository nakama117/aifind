import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { SERVER_MODULES } from "@aihot/site/modules/server";
import { MODULES } from "@aihot/site/modules";

test("module installs scoped public/admin routes and opt-in detector queues without new public abilities", () => {
  const module = SERVER_MODULES.find((m) => m.name === "aifind");
  assert.ok(module, "AIFIND domain module must be installed through the site's server list");
  assert.equal(typeof module.http, "function");
  assert.deepEqual(module.queues?.map(q=>q.name), ['aifind.observe','aifind.detect']);
  assert.equal(module.schedules?.length,1);
  assert.equal(module.schedules?.[0].when?.(),false, 'closed development valves must not schedule external observation');
  assert.deepEqual(module.sitemap?.files, ["/sitemap-products.xml", "/sitemap-aifind-editorial.xml"]);
  assert.equal(module.agent, undefined);
  const routes = MODULES.find((m) => m.name === "aifind")!;
  assert.deepEqual(routes.pages?.map(p => "path" in p ? p.path : null), ["products", "products/:slug", "compare", "categories", "compare/:slug", "categories/:slug", "howto", "howto/:slug", "editorial-policy", "contact"]);
  assert.deepEqual(routes.adminPages?.map(p => p.path), ["admin/aifind", "admin/aifind/products", "admin/aifind/products/:id", "admin/aifind/review", "admin/aifind/review/:id", "admin/aifind/monitors", "admin/aifind/preview", "admin/aifind/preview/product-domain", "admin/aifind/preview/change-detector", "admin/aifind/preview/product-discovery", "admin/aifind/compare", "admin/aifind/categories", "admin/aifind/compare/:id", "admin/aifind/categories/:id", "admin/aifind/preview/compare-category", "admin/aifind/howto", "admin/aifind/howto/:id", "admin/aifind/preview/howto-guide", "admin/aifind/preview/launch-readiness", "admin/aifind/launch-readiness"]);
  assert.equal(routes.apiPaths?.some(re => re.test("/api/admin/aifind/preview/product-domain")), true);
  assert.equal(routes.apiPaths?.some(re => re.test("/api/v1/products")), false);
  assert.deepEqual(SERVER_MODULES.filter((m) => m.name !== "aifind").map(m => m.name),
    ["model-leaderboard", "codex-monitor", "topic-chronicle"]);
});

test("generic framework has no AIFIND module dependency", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const imports: string[] = [];
  for (const directory of ["packages", "apps"]) {
    for (const entry of readdirSync(path.join(root, directory), { recursive: true, withFileTypes: true })) {
      const file = path.join(entry.parentPath, entry.name);
      if (!entry.isFile() || !/\.tsx?$/.test(file) || /[/\\](node_modules|build|\.react-router|tests)[/\\]/.test(file)) continue;
      if (/\b(?:from|import)\s*\(?\s*["'][^"']*(?:@aihot\/aifind|modules\/aifind)/.test(readFileSync(file, "utf8"))) imports.push(file);
    }
  }
  assert.deepEqual(imports, []);
});
