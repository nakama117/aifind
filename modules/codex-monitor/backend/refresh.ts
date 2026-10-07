import { sql } from "@aihot/backend/db";
import { OFFICIAL_STATUS_URL, parseOfficialStatus } from "./official-status.ts";
export { OFFICIAL_STATUS_URL } from "./official-status.ts";

/** This free status feed describes service incidents. It never creates or confirms a usage reset. */
export async function refreshOfficialStatus(options: { fetcher?: typeof fetch } = {}) {
  if (process.env.COLLECT_ENABLED !== "true") return { skipped: true, reason: "collection_disabled" };
  const attempt = new Date().toISOString();
  await sql`INSERT INTO codex_monitor_state (key, value) VALUES ('official-status', ${sql.json({ lastAttemptAt: attempt })})
    ON CONFLICT (key) DO UPDATE SET value = codex_monitor_state.value || EXCLUDED.value, updated_at = now()`;
  try {
    const response = await (options.fetcher ?? fetch)(OFFICIAL_STATUS_URL, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`OpenAI Status HTTP ${response.status}`);
    const text = await response.text();
    if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error("OpenAI Status response exceeds 2 MiB");
    const { incidents } = parseOfficialStatus(JSON.parse(text));
    await sql`UPDATE codex_monitor_state SET value = value || ${sql.json({ lastAttemptAt: attempt, lastSuccessAt: new Date().toISOString(), status: "ok", incidents } as never)}, updated_at = now() WHERE key = 'official-status'`;
    return { skipped: false, count: incidents.length };
  } catch (error) {
    await sql`UPDATE codex_monitor_state SET value = value || ${sql.json({ status: "failed" })}, updated_at = now() WHERE key = 'official-status'`;
    throw error;
  }
}
