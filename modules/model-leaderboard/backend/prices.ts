// Official API prices (lb_prices kind='official'), kept as dated files in modules/model-leaderboard/seeds
// (lb-official-prices-YYYY-MM-DD.json); a newer file adds models or replaces their earlier entries. Each
// refresh fills in the models that have no price yet; the admin can maintain a dated official record.
// The file's observation day is kept separately from the database import timestamp. Missing numeric
// values remain unknown; a note alone is not evidence that the vendor has no paid API.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "@aihot/backend/db";

const SEEDS = fileURLToPath(new URL("../seeds/", import.meta.url));
const PRICE_FILE = /^lb-official-prices-\d{4}-\d{2}-\d{2}\.json$/;

/** [currency, input, output, cached input, source url, note], per million tokens */
type Price = [string, number | null, number | null, number | null, string, string?];

/** Each model's newest entry, from one file or from every dated file (later files win). */
function seededPrices(file?: string): Map<string, { price: Price; asOf: string | null }> {
  const files = file ? [file] : readdirSync(SEEDS).filter((f) => PRICE_FILE.test(f)).sort().map((f) => path.join(SEEDS, f));
  const out = new Map<string, { price: Price; asOf: string | null }>();
  for (const f of files) {
    const seed = JSON.parse(readFileSync(f, "utf8")) as { prices: Record<string, Price> };
    const asOf = path.basename(f).match(/^lb-official-prices-(\d{4}-\d{2}-\d{2})\.json$/)?.[1] ?? null;
    for (const [slug, price] of Object.entries(seed.prices)) out.set(slug, {price, asOf});
  }
  return out;
}

export async function importOfficialPrices(opts: { file?: string; overwrite?: boolean } = {}): Promise<{ written: number; unknown: string[] }> {
  let written = 0;
  const unknown: string[] = [];
  for (const [slug, {price: [currency, input, output, cached, url, note], asOf}] of seededPrices(opts.file)) {
    const [model] = await sql<{ id: string }[]>`SELECT id FROM lb_models WHERE slug = ${slug}`;
    if (!model) {
      unknown.push(slug);
      continue;
    }
    const res = await sql`
      INSERT INTO lb_prices (model_id, kind, currency, input, output, cached_input, source_url, note, verified_on, price_origin)
      VALUES (${model.id}, 'official', ${currency}, ${input}, ${output}, ${cached}, ${url}, ${note ?? null}, ${asOf}, 'seed')
      ON CONFLICT (model_id, kind) DO ${opts.overwrite
        ? sql`UPDATE SET currency = EXCLUDED.currency, input = EXCLUDED.input, output = EXCLUDED.output, cached_input = EXCLUDED.cached_input,
                source_url = EXCLUDED.source_url, note = EXCLUDED.note, verified_on = EXCLUDED.verified_on, price_origin = 'seed', updated_at = now()`
        : sql`NOTHING`}`;
    written += res.count;
  }
  return { written, unknown };
}
