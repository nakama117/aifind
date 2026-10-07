import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { EventSchema, ImportSchema } from "../backend/schema.ts";

test("official date-only evidence does not require invented publication or confirmation times", () => {
  const result = EventSchema.safeParse({
    id: "official-date-only", type: "direct_reset", titleJa: "公式の過去記録", summaryJa: "公式原文は実施日だけを明示しています。", scopeJa: null,
    status: "confirmed", inProgress: false, reportedAt: null, schedule: null, confirmedAt: null, occurredOn: "2026-09-07", occurredOnTimezone: "unspecified",
    confirmationBasis: "source_post", evidenceJa: "原文は日付のみ記載。具体的な時刻とタイムゾーンは不明。",
    sources: [{ id: "official-source", author: "OpenAI", publishedAt: null, verifiedAt: "2026-10-04T10:57:24Z", url: "https://help.openai.com/en/articles/20001516-managing-usage-with-gpt-6-astra-in-work-and-codex", textJa: "公式ヘルプの実施済み記録。", originalExcerpt: "", stage: "confirmation" }],
  });
  assert.equal(result.success, true, "unknown publication time must remain null when a date-only event and verification time are known");
  if (!result.success) return;
  assert.equal(result.data.reportedAt, null);
  assert.equal(result.data.confirmedAt, null);
  assert.equal(result.data.sources[0].publishedAt, null);
  assert.equal(result.data.occurredOnTimezone, "unspecified");
});

test("reviewed official history contains the three dated offers, with no manufactured timestamps", () => {
  const file = new URL("../data/official-history.json", import.meta.url);
  assert.ok(existsSync(file), "reviewed official history must be saved as an importable artifact");
  const batch = ImportSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  assert.deepEqual(batch.events.map((event) => event.occurredOn), ["2026-09-03", "2026-09-04", "2026-09-07"]);
  assert.deepEqual(batch.events.map((event) => event.type), ["reset_credit", "reset_credit", "direct_reset"]);
  for (const event of batch.events) {
    assert.equal(event.reportedAt, null);
    assert.equal(event.confirmedAt, null);
    assert.equal(event.occurredOnTimezone, "unspecified");
    assert.equal(event.confirmationBasis, "source_post");
    for (const source of event.sources) {
      assert.equal(source.publishedAt, null);
      assert.ok(source.verifiedAt);
      assert.ok(source.url.startsWith("https://help.openai.com/"));
    }
  }
});

test("official history CLI validates without a database and requires an explicit apply target", () => {
  const script = fileURLToPath(new URL("../scripts/import-official-history.ts", import.meta.url));
  const env = { ...process.env, DATABASE_URL: "postgres://127.0.0.1:1/do_not_connect" };
  const dryRun = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(JSON.parse(dryRun.stdout).mode, "dry-run");
  assert.equal(JSON.parse(dryRun.stdout).count, 3);
  const missingTarget = spawnSync(process.execPath, [script, "--apply"], { env, encoding: "utf8" });
  assert.notEqual(missingTarget.status, 0);
  assert.match(missingTarget.stderr, /requires --database/);
  const scanScript = fileURLToPath(new URL("../scripts/scan-announcements.ts", import.meta.url));
  const scanDryRun = spawnSync(process.execPath, [scanScript], { env, encoding: "utf8" });
  assert.equal(scanDryRun.status, 0, scanDryRun.stderr);
  assert.equal(JSON.parse(scanDryRun.stdout).officialOnly, true);
  const scanMissing = spawnSync(process.execPath, [scanScript, "--apply"], { env, encoding: "utf8" });
  assert.notEqual(scanMissing.status, 0);
  assert.match(scanMissing.stderr, /requires --database/);
});
