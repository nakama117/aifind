import "../../../tests/setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { listHistories, readHistory, saveHistory, setHistoryEnabled } from "../backend/store.ts";

after(closeDb);
const document = { topic: "minimax", compiledOn: "2026-10-04", through: "2026-09", events: [
  { date: "2026-09-02", kind: "model", title: "検証用モデルを公開", source: "ローカルテスト", url: "https://example.org/local-fixture" },
] };

test("curated imports are stored, exported and audited without changing publication rows", async () => {
  const before = await sql`SELECT count(*)::int AS n FROM publications`;
  await saveHistory(document, "test-admin", "テスト用の出典確認");
  assert.deepEqual(await readHistory("minimax"), document);
  assert.equal((await listHistories()).find((r) => r.topic === "minimax")?.enabled, true);
  assert.equal((await sql`SELECT count(*)::int AS n FROM publications`)[0].n, before[0].n);
  assert.equal((await sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'chronicle.import' AND subject = 'chronicle:minimax'`)[0].n, 1);
});

test("withdrawal persists without falling back to bundled history, and enabling restores it", async () => {
  assert.ok(await readHistory("openai"));
  await setHistoryEnabled("openai", false, "test-admin", "掲載を取り下げ");
  assert.equal(await readHistory("openai"), null);
  assert.equal((await listHistories()).find((r) => r.topic === "openai")?.enabled, false);
  await setHistoryEnabled("openai", true, "test-admin", "再確認して掲載");
  assert.ok(await readHistory("openai"));
});

test("invalid imports leave the saved document and audit untouched", async () => {
  await assert.rejects(() => saveHistory({ ...document, events: [{ ...document.events[0], url: "" }] }, "test-admin", "不正な入力"));
  assert.deepEqual(await readHistory("minimax"), document);
});
