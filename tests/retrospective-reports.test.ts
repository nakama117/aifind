import { tag, stub } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { publishArticle } from "@aihot/backend/publication/publish";
import { loadReport, listReports, v1Daily, v1Dailies, v1Periods } from "@aihot/backend/publication/reports";
import { reportFeed } from "@aihot/backend/publication/feeds";
import { dailyAnswer, periodAnswer } from "@aihot/backend/publication/agent";
import { composeDaily, composeWeekly, composeMonthly } from "@aihot/backend/reports/compose";
import { periodEntries } from "@aihot/backend/reports/edition";
import { stopBoss } from "@aihot/backend/jobs/queue";

const provider = await stub(() => ({choices:[{message:{content:JSON.stringify({overview:"公式モデルが公開されました。",sections:{}})}}]}));
process.env.DEEPSEEK_BASE_URL = `${provider.url}/v1`;
process.env.DEEPSEEK_API_KEY = "test-key";
after(async () => { await provider.close(); await stopBoss(); await closeDb(); });

test("retrospective issues use original dates and disclose late compilation without changing article history", async () => {
  const sourceId = `retrospective-${tag()}`;
  await sql`INSERT INTO sources(id,name,kind,tier) VALUES (${sourceId},'Official release','rss','T1')`;
  const originalAt = new Date("2026-08-20T03:00:00Z");
  const { articleId } = await upsertMaterial({ sourceId, url: `https://example.org/${tag()}`, title: "公式モデル発表", excerpt: "公開されたモデルの検証済み要点です。", via: "fetch", publishedAt: originalAt, backfill: "launch-archive" });
  await sql`INSERT INTO analyses(article_id,input_revision,origin,relevance,category,title_zh,summary_zh,score,selected)
    VALUES (${articleId},1,'rule','pass','ai-models','公式モデルを公開','公開されたモデルの検証済み要点です。',80,true)`;
  await sql`UPDATE articles SET grouping_status='complete', grouped_at=now(), selection_adds_value=true WHERE id=${articleId}`;
  await publishArticle(articleId);
  const [before] = await sql`SELECT published_at, discovered_at, timeline_at, backfill FROM articles WHERE id=${articleId}`;
  await assert.rejects(composeDaily("2026-08-21"), /no selected items/, "ordinary issues must still exclude late imports");
  const start = Date.now();
  const result = await composeDaily("2026-08-21", "公開準備の補編", { retrospective: true });
  assert.equal(result.entries, 1);
  const report = await loadReport("daily", "2026-08-21");
  assert.equal(report!.retrospective, true);
  assert.match(report!.title, /補編/);
  assert.ok(Date.parse(report!.generatedAt) >= start);
  assert.equal(report!.sections[0]!.items[0]!.publishedAt, originalAt.toISOString());
  const api = await v1Daily("2026-08-21");
  assert.equal(api!.report.retrospective, true);
  assert.match((await listReports("daily"))[0]!.title!, /補編/);
  assert.equal((await v1Dailies(10)).items[0]!.retrospective, true);
  assert.match(await reportFeed("daily"), /補編/);
  assert.match(dailyAnswer(api!.report, "http"), /当時の配信記録ではありません/);
  const period = await periodEntries("2026-08-01", "2026-08-31");
  assert.equal(period.retrospective, true, "a later period issue must inherit the disclosure");
  await composeWeekly("2026-W34");
  await composeMonthly("2026-08");
  for (const [kind, key] of [["weekly", "2026-W34"], ["monthly", "2026-08"]]) {
    const [saved] = await sql`SELECT content FROM reports WHERE kind=${kind!} AND key=${key!}`;
    assert.equal(saved!.content.metrics.selectedCount, 1, "retrospective metrics must count the actual historical selection");
    assert.equal(saved!.content.themes[0].storyRefs[0].publishedAt, originalAt.toISOString());
  }
  assert.equal((await v1Periods("monthly",10)).items[0]!.retrospective, true);
  assert.match(await reportFeed("monthly"), /補編/);
  assert.match(periodAnswer({ month:"2026-08", retrospective:true, generatedAt:new Date().toISOString(), periodStart:"2026-08-01",periodEnd:"2026-08-31",links:{aihot:"https://example.org/monthly/2026-08"},headline:null,overview:null,sections:[] }, "monthly", "http"), /当時の配信記録ではありません/);
  const [after] = await sql`SELECT published_at, discovered_at, timeline_at, backfill FROM articles WHERE id=${articleId}`;
  assert.deepEqual(after, before, "backfill must not impersonate live publication");
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${articleId}`;
  const withdrawn = await v1Daily("2026-08-21");
  assert.ok(!JSON.stringify(withdrawn).includes("公式モデルを公開"));
});

test("retrospective compilation rejects a future publication window", async () => {
  await assert.rejects(composeDaily("2099-12-31", undefined, { retrospective: true }), /window must have ended/);
});
