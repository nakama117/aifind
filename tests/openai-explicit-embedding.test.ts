import { stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { sql, closeDb } from "@aihot/backend/db";

const provider = await stub(() => ({ data: [{ index: 0, embedding: [1, 0] }], usage: { prompt_tokens: 100, total_tokens: 100 } }));
Object.assign(process.env, {
  OPENAI_BASE_URL: provider.url, OPENAI_API_KEY: "local-only",
  EMBEDDING_BASE_URL: provider.url, EMBEDDING_API_KEY: "local-only", EMBEDDING_MODEL: "text-embedding-3-small",
  MODEL_CALLS_ENABLED: "true",
});
const { ensureEmbeddings } = await import("@aihot/backend/providers/embeddings");
after(async () => { await provider.close(); await closeDb(); });

test("explicit OpenAI embedding credentials still share OpenAI cost accounting and its monthly stop", async () => {
  const item = { id: `explicit-openai-${tag()}`, text: "明示的に設定した OpenAI 埋め込み" };
  assert.deepEqual((await ensureEmbeddings([item])).get(item.id), [1, 0]);
  const [receipt] = await sql`SELECT service, cost, currency FROM receipts WHERE subject=${`article:${item.id}`}`;
  assert.equal(receipt!.service, "openai");
  assert.equal(receipt!.cost, 0.000002);
  assert.equal(receipt!.currency, "USD");
  const hits = provider.hits();
  process.env.OPENAI_MONTHLY_BUDGET_USD = "0.000001";
  await assert.rejects(ensureEmbeddings([{ id: tag(), text: "予算を超える別の入力" }]), /monthly USD estimate/);
  assert.equal(provider.hits(), hits);
});
