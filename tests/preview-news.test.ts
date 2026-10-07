import "./setup.ts";
import { createTestDatabase, dropTestDatabase } from "./database-cleanup.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import postgres from "postgres";

test("preview imports sourced news with original dates, no invented scores or paid calls, and is repeatable", async () => {
  const template = new URL(process.env.DATABASE_URL!);
  const name = `news_${process.pid}_preview`;
  const target = new URL(template);
  target.pathname = `/${name}`;
  const admin = postgres(template.toString(), { max: 1, onnotice: () => {} });
  const db = postgres(target.toString(), { max: 1, onnotice: () => {} });
  try {
    await createTestDatabase(template.href, name, template.pathname.slice(1));
    const seed = () => execFileSync(process.execPath, ["scripts/seed-preview.ts"], {
      env: { ...process.env, DATABASE_URL: target.toString() }, stdio: "pipe", windowsHide: true,
    });
    seed();
    const rows = await db`SELECT article_id, url, title, summary, score, published_at, discovered_at, timeline_at,
      backfill, selected, body_mode FROM publications ORDER BY url`;
    const guide = rows.find(r => r.url === "https://openai.com/index/practical-guide-building-gpt-6/");
    assert.ok(guide, "the preview must contain an actual, linked official article");
    assert.equal(guide.published_at.toISOString(), "2026-10-02T16:15:00.000Z");
    assert.equal(guide.timeline_at.toISOString(), guide.published_at.toISOString());
    assert.ok(guide.discovered_at > guide.published_at, "import time must not impersonate the original publication time");
    for (const row of rows) {
      assert.ok(["openai.com", "www.anthropic.com", "sakana.ai", "www.preferred.jp"].includes(new URL(row.url).hostname));
      assert.equal(row.score, null);
      assert.equal(row.backfill, true);
      assert.equal(row.selected, true);
      assert.equal(row.body_mode, "summary");
      assert.doesNotMatch(`${row.title} ${row.summary}`, /【サンプル】|架空/);
    }
    const [state] = await db`SELECT (SELECT count(*)::int FROM receipt_attempts) AS calls,
      (SELECT count(*)::int FROM analyses) AS analyses,
      (SELECT count(*)::int FROM reports) AS reports,
      (SELECT count(*)::int FROM stories) AS stories,
      (SELECT count(*)::int FROM sources WHERE enabled OR site_fulltext OR syndicate_fulltext) AS unsafe_sources`;
    assert.deepEqual({ ...state }, { calls: 0, analyses: 0, reports: 0, stories: 0, unsafe_sources: 0 });
    seed();
    const after = await db`SELECT article_id, url, published_at, discovered_at, timeline_at FROM publications ORDER BY url`;
    assert.deepEqual(after.map(r => ({ ...r })), rows.map(({ article_id, url, published_at, discovered_at, timeline_at }) =>
      ({ article_id, url, published_at, discovered_at, timeline_at })));
  } finally {
    await db.end();
    await dropTestDatabase(template.href, name);
    await admin.end();
  }
});
