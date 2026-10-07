import "../../../tests/setup.ts";
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { after, beforeEach, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { stub, Reply } from "../../../tests/setup.ts";

after(closeDb);
beforeEach(async () => { await sql`DELETE FROM codex_monitor_events`; await sql`DELETE FROM codex_monitor_state`; });
const source = { id: "post-one", author: "OpenAI", publishedAt: "2026-10-04T15:30:00Z", url: "https://openai.com/index/codex/", textJa: "テスト用の告知要約", originalExcerpt: "Codex usage limits will reset.", stage: "announcement" };
const event = {
  id: "test-reset", type: "direct_reset", titleJa: "Codex 利用枠リセットの告知", summaryJa: "テスト用の要約です。", scopeJa: null,
  status: "announced", inProgress: false, reportedAt: source.publishedAt,
  schedule: { precision: "window", from: "2026-10-04T16:00:00Z", through: "2026-10-04T17:00:00Z", labelJa: "10月5日 01:00〜02:00 JST" },
  confirmedAt: null, occurredOn: null, confirmationBasis: null, evidenceJa: null, sources: [source],
};

test("import, evidence checks, corrections and withdrawal share one public projection", async () => {
  const storeUrl = new URL("../backend/admin.ts", import.meta.url);
  assert.ok(existsSync(storeUrl), "Codex monitor needs an audited import and correction implementation");
  const { importAnnouncements, updateEvent, listAdminMonitor } = await import(storeUrl.href);
  const { loadMonitorSnapshot, loadMonitorPage, loadMonitorVersion } = await import("../backend/publication.ts");
  const empty = await loadMonitorSnapshot(Date.parse("2026-10-04T18:00:00Z"));
  assert.equal(empty.monitor.status, "unknown");
  assert.equal(empty.historyFrom, null);
  assert.equal(empty.count, 0);
  assert.equal(empty.monitor.lastReviewedAt, null);

  await assert.rejects(importAnnouncements({ events: [{ ...event, status: "confirmed" }], reason: "证据不足测试" }, "test"));
  await assert.rejects(importAnnouncements({ events: [{ ...event, sources: [{ ...source, url: "javascript:alert(1)" }] }], reason: "不安全来源测试" }, "test"));
  assert.equal((await loadMonitorSnapshot()).count, 0);
  const imported = await importAnnouncements({ events: [event], reason: "人工逐项核验测试" }, "test");
  assert.equal(imported.imported, 1);
  await assert.rejects(importAnnouncements({ events: [event], reason: "不得静默覆盖" }, "test"), /已存在/);
  await sql`UPDATE codex_monitor_events SET body = body || ${sql.json({ internalNote: "not-public", receiptToken: "test-private-token" })} WHERE id = ${event.id}`;
  const page = await loadMonitorPage("2026-10-05", Date.parse("2026-10-04T18:00:00Z"));
  assert.equal(page.timezone, "Asia/Tokyo");
  assert.equal(page.today, "2026-10-05");
  assert.equal(page.dayEvents.length, 1);
  assert.ok(!JSON.stringify(page).includes("not-public"), "public projections allowlist fields even when storage has internal metadata");
  assert.ok(!JSON.stringify(page).includes("test-private-token"));
  assert.equal(page.events[0].presentation.status, "expired_unconfirmed");
  assert.equal(page.events[0].sources[0].publishedAt, "2026-10-05T00:30:00.000+09:00");
  assert.equal(page.stats.resets90, 0, "an expired estimate is not a confirmed reset");
  assert.equal(page.monitor.status, "partial", "manual import is not full upstream monitoring coverage");
  const admin = await listAdminMonitor();
  await assert.rejects(updateEvent(event.id, { event: { ...event, summaryJa: "変更" }, version: "stale", reason: "競合" }, "test"), /刷新/);
  await updateEvent(event.id, { event: { ...event, status: "confirmed", confirmedAt: "2026-10-04T16:40:00Z", confirmationBasis: "source_post", evidenceJa: "公式投稿が完了を明示。", sources: [{ ...source, stage: "confirmation" }] }, version: admin.events[0].version, reason: "来源确认" }, "test");
  const confirmed = await loadMonitorSnapshot(Date.parse("2026-10-04T18:00:00Z"));
  assert.equal(confirmed.stats.resets90, 1);
  assert.equal(confirmed.confirmMinutes[0], 100);
  assert.equal(confirmed.events[0].confirmationBasis, "source_post");
  assert.notEqual(confirmed.version, page.version);
  const row = (await listAdminMonitor()).events[0];
  await updateEvent(event.id, { withdrawn: true, version: row.version, reason: "撤回测试" }, "test");
  const withdrawn = await loadMonitorSnapshot(Date.parse("2026-10-04T18:00:00Z"));
  assert.equal(withdrawn.count, 0);
  assert.equal(withdrawn.calendar.length, 0);
  assert.equal(withdrawn.activities.length, 0);
  assert.equal(withdrawn.stats.resets90, 0);
  assert.notEqual((await loadMonitorVersion(Date.parse("2026-10-04T18:00:00Z"))).version, confirmed.version);
  assert.equal((await listAdminMonitor()).events[0].withdrawn, true);
  const [audit] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM audit_log WHERE subject = 'codex-monitor:test-reset'`;
  assert.equal(audit.n, 3);
});

test("official status refresh is gated, local-testable and cannot confirm usage resets", async () => {
  const url = new URL("../backend/refresh.ts", import.meta.url);
  assert.ok(existsSync(url), "Codex monitor needs a free official status refresh");
  const { refreshOfficialStatus } = await import(url.href);
  const { loadMonitorSnapshot } = await import("../backend/publication.ts");
  const server = await stub(() => ({ incidents: [
    { id: "codex-issue", name: "Codex errors", status: "resolved", created_at: "2026-10-04T15:00:00Z", updated_at: "2026-10-04T16:00:00Z", resolved_at: "2026-10-04T16:00:00Z" },
    { id: "other-issue", name: "ChatGPT issue", status: "investigating", created_at: "2026-10-04T15:00:00Z", updated_at: "2026-10-04T16:00:00Z", resolved_at: null },
  ] }));
  const fetcher = () => fetch(server.url);
  try {
    process.env.COLLECT_ENABLED = "false";
    assert.equal((await refreshOfficialStatus({ fetcher })).skipped, true);
    assert.equal(server.hits(), 0);
    process.env.COLLECT_ENABLED = "true";
    await refreshOfficialStatus({ fetcher });
    const current = await loadMonitorSnapshot();
    assert.equal(current.incidents.length, 1);
    assert.equal(current.incidents[0].url, "https://status.openai.com/incidents/codex-issue");
    assert.equal(current.count, 0, "resolved service incidents are not reset confirmations");
    assert.equal(current.monitor.statusFetch, "ok");
    const failed = await stub(() => new Reply(503, { error: "unavailable" }));
    try {
      await assert.rejects(refreshOfficialStatus({ fetcher: () => fetch(failed.url) }), /503/);
      const retained = await loadMonitorSnapshot();
      assert.equal(retained.incidents.length, 1);
      assert.equal(retained.monitor.statusFetch, "failed");
      assert.equal(retained.monitor.lastStatusSuccessAt, current.monitor.lastStatusSuccessAt);
    } finally { await failed.close(); }
  } finally { process.env.COLLECT_ENABLED = "false"; await server.close(); }
});

test("official date-only history remains truthful through the public page and Agent projection", async () => {
  const { importAnnouncements } = await import("../backend/admin.ts");
  const { loadMonitorPage } = await import("../backend/publication.ts");
  const { monitorAnswer } = await import("../backend/agent.ts");
  const batch = JSON.parse(readFileSync(new URL("../data/official-history.json", import.meta.url), "utf8"));
  await importAnnouncements(batch, "test:official-history");
  const page = await loadMonitorPage("2026-09-07", Date.parse("2026-10-04T12:00:00Z"));
  assert.equal(page.count, 3);
  assert.equal(page.dayEvents.length, 1);
  assert.equal(page.dayEvents[0].occurredOnTimezone, "unspecified");
  assert.equal(page.dayEvents[0].confirmedAt, null);
  assert.equal(page.dayEvents[0].reportedAt, null);
  assert.equal(page.dayEvents[0].sources[0].publishedAt, null);
  assert.equal(page.dayEvents[0].sources[0].verifiedAt, "2026-10-04T19:57:24.000+09:00");
  assert.equal(page.stats.resets90, 1);
  assert.equal(page.stats.credits90, 2);
  assert.equal(page.stats.medianIntervalDays, null);
  assert.deepEqual(page.confirmMinutes, []);
  assert.match(monitorAnswer(page), /タイムゾーン・時刻不明/);
  assert.match(monitorAnswer(page), /公開日時：不明/);
});
