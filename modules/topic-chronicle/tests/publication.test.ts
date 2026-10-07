import { tag } from "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { config } from "@aihot/backend/config";
import { installModules } from "@aihot/backend/modules";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { loadTopicPage } from "@aihot/backend/publication/topics";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { buildApp } from "@aihot/api/app";
import { topicChronicleServer } from "../server.ts";
import { readHistory, saveHistory, setHistoryEnabled } from "../backend/store.ts";
import type { ChroniclePart } from "../types.ts";

installModules([topicChronicleServer]);
const app = await buildApp();
const source = `test-chronicle-${tag()}`;
let articleId: string;
before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, next_fetch_at)
    VALUES (${source}, 'Local official fixture', 'rss', 'T1', 'editorial', true, '2100-01-01')`;
  const at = new Date(Date.now() - 2 * 3600_000);
  const material = await upsertMaterial({ sourceId: source, url: `https://example.org/${source}`, title: "OpenAI、検証モデルを公開", bodyText: "local fixture", bodyHtml: "<p>local fixture</p>", bodyStatus: "ok", via: "fetch", publishedAt: at });
  articleId = material.articleId;
  await sql`UPDATE articles SET discovered_at = ${at}, timeline_at = ${at}, grouped_at = now() WHERE id = ${articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
    VALUES (${articleId}, 1, 'rule', 'pass', 'ai-models', 'OpenAI、検証モデルを公開', '検証用の短い要約', 90, true, ${["openai"]}, ${["モデル公開"]})`;
  await publishArticle(articleId, { releasedAt: new Date(at.getTime() + 60_000) });
});
after(async () => { await app.close(); installModules([]); await stopBoss(); await closeDb(); });

const partOf = (page: Awaited<ReturnType<typeof loadTopicPage>>) => {
  const part = page?.modules["topic-chronicle"] as ChroniclePart;
  assert.ok(Array.isArray(part?.milestones), "loadTopicPage must resolve async module parts before returning public JSON");
  return part;
};

test("extending a sparse archive through the current month preserves other current public news", async () => {
  const original = (await readHistory("openai"))!;
  try {
    await saveHistory({ ...original, through: "2026-10" }, "test-admin", "疎な歴史資料の範囲を更新");
    const current = partOf(await loadTopicPage("openai", 1));
    assert.ok(current.months.flatMap((m) => m.events).some((e) => e.id === articleId));
    assert.ok(current.milestones.some((m) => m.href === `/items/${articleId}`));
  } finally { await saveHistory(original, "test-admin", "テスト前の資料に戻す"); }
});

test("loadTopicPage resolves the archive and reflects withdrawal even with a warm topic index", async () => {
  const before = partOf(await loadTopicPage("openai", 1));
  assert.equal(before.archive?.compiledOn, "2026-10-04");
  assert.ok(before.milestones.some((m) => m.href === "https://openai.com/index/chatgpt/"));
  await setHistoryEnabled("openai", false, "test-admin", "出典の再確認");
  const withdrawn = partOf(await loadTopicPage("openai", 1));
  assert.equal(withdrawn.archive, null);
  assert.ok(withdrawn.milestones.every((m) => !m.external));
  await setHistoryEnabled("openai", true, "test-admin", "出典を確認");
});

test("the public HTTP topic endpoint never names a withdrawn report from the cached index", async () => {
  const before = partOf(await loadTopicPage("openai", 1));
  assert.ok(before.months.flatMap((m) => m.events).some((e) => e.id === articleId));
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${articleId}`;
  const response = await app.inject({ method: "GET", url: "/api/site/topics/openai" });
  assert.equal(response.statusCode, 200);
  const current = partOf(response.json());
  assert.ok(current.months.flatMap((m) => m.events).every((e) => e.id !== articleId));
  assert.ok(!JSON.stringify(current).includes("検証モデル"));
  assert.ok(current.milestones.some((m) => m.source === "OpenAI"), "independent source-attributed historical records remain");
});

test("anonymous visitors cannot read or mutate historical archive management", async () => {
  for (const method of ["GET", "POST"] as const) {
    const response = await app.inject({ method, url: method === "GET" ? "/api/admin/topic-chronicle" : "/api/admin/topic-chronicle/import", ...(method === "POST" ? { payload: { document: {}, reason: "unauthorized" } } : {}) });
    assert.equal(response.statusCode, 401);
  }
});

test("authenticated archive imports require CSRF and publish only validated source-attributed documents", async () => {
  const previous = config.devAdmin;
  config.devAdmin = { displayName: "Local chronicle test admin" };
  try {
    const document = { topic: "cursor", compiledOn: "2026-10-04", through: "2026-09", events: [
      { date: "2026-09-01", kind: "product", title: "テスト用の公開記録", source: "ローカル検証", url: "https://example.org/chronicle-fixture" },
    ] };
    const payload = { document, reason: "出典と日付をテストで確認" };
    const refused = await app.inject({ method: "POST", url: "/api/admin/topic-chronicle/import", payload });
    assert.equal(refused.statusCode, 403);
    const accepted = await app.inject({ method: "POST", url: "/api/admin/topic-chronicle/import", headers: { "x-csrf-token": "dev" }, payload });
    assert.equal(accepted.statusCode, 200);
    assert.equal(partOf(await loadTopicPage("cursor", 1)).milestones[0]?.href, "https://example.org/chronicle-fixture");
    const invalid = await app.inject({ method: "POST", url: "/api/admin/topic-chronicle/import", headers: { "x-csrf-token": "dev" }, payload: { ...payload, document: { ...document, events: [{ ...document.events[0], source: "" }] } } });
    assert.equal(invalid.statusCode, 400);
    const invalidUrl = await app.inject({ method: "POST", url: "/api/admin/topic-chronicle/import", headers: { "x-csrf-token": "dev" }, payload: { ...payload, document: { ...document, events: [{ ...document.events[0], url: "not a URL" }] } } });
    assert.equal(invalidUrl.statusCode, 400, "malformed source URLs are a validation error, not a server error");
    const hidden = await app.inject({ method: "POST", url: "/api/admin/topic-chronicle/cursor/visibility", headers: { "x-csrf-token": "dev" }, payload: { enabled: false, reason: "記録を撤下" } });
    assert.equal(hidden.statusCode, 200);
    assert.equal(partOf(await loadTopicPage("cursor", 1)).archive, null);
  } finally { config.devAdmin = previous; }
});

test("monthly ranking retains source coverage from the publication reader", async () => {
  const secondary = `${source}-secondary`;
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, next_fetch_at)
    VALUES (${secondary}, 'Local secondary fixture', 'rss', 'T2', 'editorial', '2100-01-01')`;
  for (let n = 1; n <= 4; n++) {
    const title = `OpenAI、Model ${n}を公開`;
    const at = new Date(Date.now() - (5 - n) * 3600_000);
    const [fact] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, title) VALUES (${`coverage-${tag()}`}, ${title}) RETURNING id`;
    for (const sourceId of n === 4 ? [source, secondary] : [source]) {
      const { articleId: id } = await upsertMaterial({ sourceId, url: `https://example.org/${sourceId}-coverage-${n}`, title, bodyText: "local", bodyHtml: "<p>local</p>", bodyStatus: "ok", via: "fetch", publishedAt: at });
      await sql`UPDATE articles SET discovered_at = ${at}, timeline_at = ${at}, grouped_at = now() WHERE id = ${id}`;
      await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
        VALUES (${id}, 1, 'rule', 'pass', 'ai-models', ${title}, '検証用の短い要約', 85, ${sourceId === source}, ${["openai"]}, ${["モデル公開"]})`;
      await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES (${fact.id}, ${id}, 'report')`;
      await publishArticle(id, { releasedAt: new Date(at.getTime() + 60_000) });
    }
  }
  const current = partOf(await loadTopicPage("openai", 1, new Date()));
  const titles = current.months.flatMap((m) => m.events.map((e) => e.title));
  assert.equal(titles.length, 3);
  assert.ok(titles.includes("OpenAI、Model 4を公開"), "two-source coverage outranks an equally scored one-source event");
});
