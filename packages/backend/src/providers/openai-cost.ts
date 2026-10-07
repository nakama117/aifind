import type { Db } from "../db.ts";

/** Provider billing months use UTC. Includes retries and embeddings recorded in this database. */
export async function openaiMonthUsage(db: Db): Promise<{ spent: number; limit: number }> {
  const [row] = await db`SELECT coalesce(sum(cost), 0) AS total FROM receipt_attempts
    WHERE service='openai' AND origin='live' AND currency='USD'
      AND started_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;
  return { spent: Number(row!.total), limit: Number(process.env.OPENAI_MONTHLY_BUDGET_USD ?? 8) };
}

/** Standard API rates checked 2026-10-04. Estimates, never invoice totals. USD per million tokens. */
export function openaiCost(model: string, usage: Record<string, unknown> | null) {
  if (!usage) return null;
  const input = Number(usage.prompt_tokens ?? usage.input_tokens);
  const output = model === "text-embedding-3-small" ? 0 : Number(usage.completion_tokens ?? usage.output_tokens);
  const cached = Number((usage.prompt_tokens_details as { cached_tokens?: number } | undefined)?.cached_tokens ?? 0);
  if (![input, output, cached].every((v) => Number.isFinite(v) && v >= 0) || cached > input) return null;
  let amount: number;
  if (model === "gpt-6-luna") amount = ((input - cached) * 0.1 + cached * 0.01 + output * 0.5) / 1_000_000;
  else if (model === "text-embedding-3-small") amount = input * 0.02 / 1_000_000;
  else return null;
  return { amount, currency: "USD", basis: "estimated" as const };
}
