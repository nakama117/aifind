import { Reply, stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { z } from "zod";
import { closeDb, sql } from "@aihot/backend/db";
import { chatJson, ModelOutputError } from "@aihot/backend/providers/llm";
import { assertAccepted, ProviderRejectedError } from "@aihot/backend/providers/receipts";

let mode = "ok";
const requests: Record<string, unknown>[] = [];
const provider = await stub((_hit, req) => {
  requests.push(JSON.parse(req.body));
  if (mode === "billing") return new Reply(429, { error: { code: "project_spend_limit_exceeded", message: "Monthly limit" } });
  if (req.url.endsWith("/embeddings")) return { data: [{ index: 0, embedding: [1, 0, 0] }], usage: { prompt_tokens: 100, total_tokens: 100 } };
  return { id: "local-test", choices: [{ finish_reason: mode === "truncated" ? "length" : "stop", message: { content: '{"title":"新モデルを公開"}' } }], usage: { prompt_tokens: 1000, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 200 } } };
});
Object.assign(process.env, { OPENAI_BASE_URL: `${provider.url}/v1`, OPENAI_API_KEY: "local-test-only", MODEL_CALLS_ENABLED: "true" });
const options = () => ({ model: "gpt-6-luna", purpose: "score_article", subject: `article:${tag()}`, promptVersion: "ja-test-v1", system: "Return JSON", user: `test-${tag()}`, schema: z.object({ title: z.string() }), maxTokens: 900 });
after(async () => { await provider.close(); await closeDb(); });

test("OpenAI receives supported parameters and records usage costs while score attempts remain independent", async () => {
  const opts = options();
  const a = await chatJson({ ...opts, attemptTag: "score-1" });
  const replay = await chatJson({ ...opts, attemptTag: "score-1" });
  const b = await chatJson({ ...opts, attemptTag: "score-2" });
  assert.equal(requests.length, 2);
  assert.equal(replay.reused, true);
  assert.notEqual(a.receiptId, b.receiptId);
  assert.equal(requests[0]!.max_completion_tokens, 900);
  assert.equal(requests[0]!.reasoning_effort, "none");
  assert.equal(requests[0]!.max_tokens, undefined);
  assert.equal(requests[0]!.temperature, undefined);
  assert.equal(requests[0]!.thinking, undefined);
  const [receipt] = await sql`SELECT cost, currency, cost_basis FROM receipts WHERE id=${a.receiptId}`;
  assert.ok(Math.abs(Number(receipt!.cost) - 0.000132) < 0.00000001);
  assert.equal(receipt!.currency, "USD");
  assert.equal(receipt!.cost_basis, "estimated");
});
test("a syntactically valid but truncated completion cannot be published", async () => {
  mode = "truncated";
  await assert.rejects(chatJson(options()), ModelOutputError);
  mode = "ok";
});
test("billing errors differ from transient rate limits", () => {
  for (const code of ["project_spend_limit_exceeded", "organization_spend_limit_exceeded", "insufficient_quota", "credit_balance_exhausted"]) {
    assert.throws(() => assertAccepted("openai", 429, JSON.stringify({ error: { code } })), (e: unknown) => e instanceof ProviderRejectedError && !e.retryable);
  }
  assert.throws(() => assertAccepted("openai", 429, '{"error":{"code":"rate_limit_exceeded"}}'), (e: unknown) => e instanceof ProviderRejectedError && e.retryable);
});
test("OpenAI embeddings share the cost ledger and replay a saved vector", async () => {
  delete process.env.EMBEDDING_API_KEY;
  delete process.env.EMBEDDING_MODEL;
  delete process.env.EMBEDDING_DIMS;
  const { ensureEmbeddings } = await import("@aihot/backend/providers/embeddings");
  const item = { id: `embedding-${tag()}`, text: "日本語の埋め込みテスト" };
  const before = provider.hits();
  assert.deepEqual((await ensureEmbeddings([item])).get(item.id), [1, 0, 0]);
  assert.deepEqual((await ensureEmbeddings([item])).get(item.id), [1, 0, 0]);
  assert.equal(provider.hits(), before + 1);
  const [receipt] = await sql`SELECT service, model, cost FROM receipts WHERE subject=${`article:${item.id}`}`;
  assert.equal(receipt!.service, "openai");
  assert.equal(receipt!.model, "text-embedding-3-small");
  assert.equal(Number(receipt!.cost), 0.000002);
});
test("the monthly estimate stops new requests while completed responses remain available", async () => {
  const opts = options();
  const paid = await chatJson(opts);
  const before = provider.hits();
  const previous = process.env.OPENAI_MONTHLY_BUDGET_USD;
  process.env.OPENAI_MONTHLY_BUDGET_USD = "0.000001";
  try {
    await assert.rejects(chatJson(options()), /monthly USD estimate/);
    assert.equal(provider.hits(), before);
    assert.equal((await chatJson(opts)).receiptId, paid.receiptId);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_MONTHLY_BUDGET_USD;
    else process.env.OPENAI_MONTHLY_BUDGET_USD = previous;
  }
});
test("billing exhaustion blocks subsequent new paid requests but permits replay of already paid responses", async () => {
  const opts = options();
  const paid = await chatJson(opts);
  mode = "billing";
  await assert.rejects(chatJson(options()));
  const hits = provider.hits();
  await assert.rejects(chatJson(options()), /paused|exhausted/i);
  assert.equal(provider.hits(), hits, "no second request after billing pause");
  assert.equal((await chatJson(opts)).receiptId, paid.receiptId);
});
