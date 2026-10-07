import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { config } from "@aihot/backend/config";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { listContent } from "@aihot/backend/admin/content";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { buildApp } from "../apps/api/src/app.ts";

const source = `content-list-${tag()}`;
await sql`INSERT INTO sources (id, name, kind, tier) VALUES (${source}, '内容管理测试', 'rss', 'T1')`;
const ids: string[] = [];
for (let i = 0; i < 53; i++) {
  const { articleId } = await upsertMaterial({ sourceId: source, url: `https://example.com/${source}/${i}`, title: `日本語のニュース ${i}`, via: "fetch" });
  ids.push(articleId);
  if (i === 52) { await sql`UPDATE articles SET processing_state = 'failed' WHERE id = ${articleId}`; continue; }
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, title_zh, summary_zh, selected)
    VALUES (${articleId}, 1, 'rule', 'pass', ${`編集済みニュース ${i}`}, '日本語の記事の要約です。', ${i === 0})`;
  await sql`UPDATE articles SET grouping_status = 'complete', grouped_at = now() WHERE id = ${articleId}`;
  await publishArticle(articleId);
  if (i === 1) await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${articleId}`;
}
const app = await buildApp();
after(async () => { await app.close(); await stopBoss(); await closeDb(); });

test("content manager lists newest items without a search and paginates without duplicates", async () => {
  const first = await listContent({ source });
  const second = await listContent({ source, page: 2 });
  assert.equal(first.total, 53);
  assert.equal(first.rows.length, 50);
  assert.equal(second.rows.length, 3);
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 53);
  assert.ok(first.sources.some((s) => s.id === source));
});

test("state and selection filters keep withdrawn and unprocessed content reachable to the editor", async () => {
  assert.deepEqual((await listContent({ source, state: "withdrawn" })).rows.map((r) => r.id), [ids[1]]);
  assert.deepEqual((await listContent({ source, state: "unpublished" })).rows.map((r) => r.id), [ids[52]]);
  assert.deepEqual((await listContent({ source, state: "failed" })).rows.map((r) => r.id), [ids[52]]);
  assert.deepEqual((await listContent({ source, selected: "true" })).rows.map((r) => r.id), [ids[0]]);
  assert.equal((await listContent({ source, state: "public", selected: "false" })).total, 50);
});

test("Japanese title, exact ID and URL searches retain the filters and bounded pagination", async () => {
  assert.equal((await listContent({ q: "編集済み", source })).total, 52);
  assert.equal((await listContent({ q: ids[1], state: "public" })).total, 0);
  assert.equal((await listContent({ q: `https://example.com/${source}/2` })).rows[0]?.id, ids[2]);
  assert.equal((await listContent({ q: "%", source })).total, 0);
  await assert.rejects(listContent({ page: -1 }));
  await assert.rejects(listContent({ state: "bogus" }));
});

test("content listing stays admin-only and rejects malformed filters", async () => {
  const before = config.devAdmin;
  config.devAdmin = null;
  try {
    assert.equal((await app.inject({ url: "/api/admin/content" })).statusCode, 401);
    config.devAdmin = { displayName: "Content test" };
    const response = await app.inject({ url: `/api/admin/content?source=${source}&page=2` });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().rows.length, 3);
    assert.equal((await app.inject({ url: "/api/admin/content?state=bogus" })).statusCode, 400);
  } finally { config.devAdmin = before; }
});
