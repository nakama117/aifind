import { Reply, stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { processArticle } from "@aihot/backend/jobs/content";
import { stopBoss } from "@aihot/backend/jobs/queue";

let billing = true;
const provider = await stub(() => billing
  ? new Reply(429, { error: { code: "insufficient_quota" } })
  : { choices: [{ finish_reason: "stop", message: { content: '{"label":"BLOCK","reason":"テスト用の無関係な資料"}' } }], usage: { prompt_tokens: 100, completion_tokens: 20 } });
Object.assign(process.env, { OPENAI_BASE_URL: provider.url, OPENAI_API_KEY: "local-test-only", PREFILTER_MODEL: "gpt-6-luna", MODEL_CALLS_ENABLED: "true" });
after(async () => { await provider.close(); await stopBoss(); await closeDb(); });

test("the first quota rejection waits without consuming article retries and resumes after the operator clears the pause", async () => {
  const source = `quota-${tag()}`;
  await sql`INSERT INTO sources (id, name, kind, tier, enabled) VALUES (${source}, 'Local fixture', 'rss', 'T1', false)`;
  const { articleId } = await upsertMaterial({ sourceId: source, url: `https://example.com/${source}`, title: "無関係な資料", bodyText: "これはテスト専用の無関係な資料です。", bodyStatus: "ok", via: "import" });
  assert.equal((await processArticle(articleId)).state, "waiting");
  const [row] = await sql`SELECT processing_attempts, processing_retry_at FROM articles WHERE id=${articleId}`;
  assert.equal(row!.processing_attempts, 0);
  assert.ok(row!.processing_retry_at);
  const [pause] = await sql`SELECT service FROM provider_pauses WHERE service='openai'`;
  assert.ok(pause);
  await sql`UPDATE articles SET processing_retry_at=now() WHERE id=${articleId}`;
  assert.equal((await processArticle(articleId)).state, "waiting");
  assert.equal(provider.hits(), 1, "durable pause blocks another external request");
  billing = false;
  await sql`DELETE FROM provider_pauses WHERE service='openai'`;
  await sql`UPDATE articles SET processing_retry_at=now() WHERE id=${articleId}`;
  assert.equal((await processArticle(articleId)).state, "block");
  assert.equal(provider.hits(), 2);
  const attempts = await sql`SELECT status FROM receipt_attempts ORDER BY id`;
  assert.deepEqual(attempts.map(r => r.status), ["failed", "received"]);
});
