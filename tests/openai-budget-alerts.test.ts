import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { getBoss, stopBoss } from "@aihot/backend/jobs/queue";
import { collectFindings } from "@aihot/backend/operations/alerts";
import { paidRequest } from "@aihot/backend/providers/receipts";
process.env.OPENAI_MONTHLY_BUDGET_USD = "8";
before(async () => { await getBoss(); });
after(async () => { await stopBoss(); await closeDb(); });

test("the operator sees the 80 percent cost warning and a durable billing pause", async () => {
  await paidRequest({ service: "openai", purpose: "test", identity: tag() }, async () => ({ response: {}, cost: { amount: 6.4, currency: "USD", basis: "estimated" } }));
  assert.ok((await collectFindings()).some(f => f.key === "budget.month.openai"));
  await sql`INSERT INTO provider_pauses (service, reason) VALUES ('openai', 'project_spend_limit_exceeded')`;
  const pause = (await collectFindings()).find(f => f.key === "provider.paused.openai");
  assert.ok(pause);
  assert.match(pause.action ?? "", /手动|人工/);
});
