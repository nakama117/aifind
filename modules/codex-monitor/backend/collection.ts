import { config, credential } from "@aihot/backend/config";
import { sql } from "@aihot/backend/db";
import { sha256, stableJson } from "@aihot/backend/lib/ids";
import { completeReceipt } from "@aihot/backend/providers/receipts";
import { collectionEnabled, type SourceState } from "./collection-schema.ts";
import { readAnnouncementSource, type PageFetcher } from "./collect-sources.ts";
import { asDocument, collectionSettings, existingEvents, sourceStates, type DocumentRow } from "./collection-store.ts";
import { recognizeDocument } from "./recognize.ts";
import { applyRecognition } from "./apply-recognition.ts";

function failureCode(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "";
  // Provider response bodies are not a suitable administrator/public status message.
  return /^(?:source_[a-z_0-9]+|codex_monitor_requires_openai)$/.test(message) ? message : name;
}
export async function collectAnnouncements(opts: { fetcher?: PageFetcher; now?: Date; officialOnly?: boolean } = {}) {
  if (!collectionEnabled()) return { skipped: true, reason: "collection_disabled", stored: 0, failed: 0 };
  const { sources } = await collectionSettings();
  const states = await sourceStates();
  let stored = 0;
  let failed = 0;
  for (const source of sources.filter((source) => source.enabled && (!opts.officialOnly || source.kind !== "x_search"))) {
    if (!collectionEnabled()) break;
    const observedAt = (opts.now ?? new Date()).toISOString();
    const key = `announcement:${source.id}`;
    const previous = states.get(source.id) ?? {};
    let state: SourceState = { ...previous, lastAttemptAt: observedAt };
    if (source.kind === "x_search" && !credential("collectors", "SOCIALDATA_API_KEY")) {
      state = { ...state, status: "missing_credentials", failureCode: "socialdata_not_configured" };
      failed++;
      await sql`INSERT INTO codex_monitor_state (key,value) VALUES (${key},${sql.json(state as never)}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=clock_timestamp()`;
      continue;
    }
    try {
      const result = await readAnnouncementSource(source, previous, observedAt, opts.fetcher);
      const count = await sql.begin(async (tx) => {
        let inserted = 0;
        for (const document of result.documents) {
          const hash = sha256(stableJson({ text: document.text, publishedAt: document.publishedAt, context: document.context }));
          const id = `document-${sha256(`${document.key}|${hash}`).slice(0, 32)}`;
          await tx`UPDATE codex_monitor_documents SET is_current=false WHERE document_key=${document.key} AND id<>${id} AND is_current`;
          const rows = await tx`INSERT INTO codex_monitor_documents (id,document_key,source_key,content_hash,url,author,published_at,observed_at,last_seen_at,body_text,context)
            VALUES (${id},${document.key},${document.sourceKey},${hash},${document.url},${document.author},${document.publishedAt},${document.observedAt},${document.observedAt},${document.text},${tx.json(document.context as never)})
            ON CONFLICT (document_key,content_hash) DO NOTHING RETURNING id`;
          inserted += rows.length;
          if (!rows.length) await tx`UPDATE codex_monitor_documents SET last_seen_at=${observedAt}, is_current=true WHERE id=${id}`;
        }
        for (const receiptId of result.receiptIds) await completeReceipt(tx, receiptId);
        state = { ...state, ...result.patch, status: "ok", failureCode: undefined, lastSuccessAt: observedAt };
        await tx`INSERT INTO codex_monitor_state (key,value) VALUES (${key},${tx.json(state as never)}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=clock_timestamp()`;
        return inserted;
      });
      stored += count;
    } catch (error) {
      failed++;
      state = { ...state, status: "failed", failureCode: failureCode(error) };
      await sql`INSERT INTO codex_monitor_state (key,value) VALUES (${key},${sql.json(state as never)}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=clock_timestamp()`;
    }
  }
  return { skipped: false, stored, failed };
}

export async function processAnnouncements(limit = 20, opts: { officialOnly?: boolean } = {}) {
  if (!collectionEnabled() || process.env.MODEL_CALLS_ENABLED !== "true" || !config.modelCallsEnabled) return { skipped: true, reason: "recognition_disabled", processed: 0, failed: 0, review: 0 };
  const { sources } = await collectionSettings();
  const states = await sourceStates();
  const active = sources.filter((source) => source.enabled && !(states.get(source.id)?.backlog) && (!opts.officialOnly || source.kind !== "x_search"));
  if (!active.length) return { skipped: false, processed: 0, failed: 0, review: 0 };
  const rows = await sql<DocumentRow[]>`SELECT * FROM codex_monitor_documents WHERE is_current AND status IN ('pending','failed') AND source_key IN ${sql(active.map((source) => source.id))}
    ORDER BY coalesce(published_at,observed_at), observed_at, document_key LIMIT ${Math.min(Math.max(limit, 1), 50)}`;
  let processed = 0;
  let failed = 0;
  let review = 0;
  for (const row of rows) {
    if (!collectionEnabled() || process.env.MODEL_CALLS_ENABLED !== "true" || !config.modelCallsEnabled) break;
    const document = asDocument(row);
    const source = active.find((source) => source.id === document.sourceKey)!;
    if (source.kind === "official_page" && source.url !== document.url || source.kind === "x_search" && source.handle !== document.author) continue;
    if (document.text.length > 24_000) {
      await sql`UPDATE codex_monitor_documents SET status='review', review_reason='原文超过单次识别长度，须人工核验；未截断生成结论', updated_at=clock_timestamp() WHERE id=${row.id}`;
      review++; continue;
    }
    try {
      const recognized = await recognizeDocument(document, await existingEvents());
      const outcome = await sql.begin(async (tx) => {
        const [current] = await tx<{ status: string; is_current: boolean; updated_at: Date }[]>`SELECT status,is_current,updated_at FROM codex_monitor_documents WHERE id=${row.id} FOR UPDATE`;
        // A concurrent administrator may have dismissed/reviewed this revision while the model was running.
        if (!current || !current.is_current || current.updated_at.toISOString() !== document.version) {
          await completeReceipt(tx, recognized.receiptId);
          return null;
        }
        const applied = await applyRecognition(tx, document, recognized.data, { actor: "worker:codex-monitor", reason: `来源修订 ${row.id}；回执 ${recognized.receiptId}` });
        const status = applied.problems.length ? "review" : "processed";
        await tx`UPDATE codex_monitor_documents SET recognition=${tx.json(recognized.data as never)}, receipt_id=${recognized.receiptId}, status=${status}, applied_ids=${applied.appliedIds}, review_reason=${applied.problems.join("；") || null}, processed_at=now(), updated_at=clock_timestamp() WHERE id=${row.id}`;
        await completeReceipt(tx, recognized.receiptId);
        return status;
      });
      if (outcome) { processed++; if (outcome === "review") review++; }
    } catch (error) {
      await sql.begin(async (tx) => {
        const [current] = await tx<{ updated_at: Date }[]>`SELECT updated_at FROM codex_monitor_documents WHERE id=${row.id} FOR UPDATE`;
        // Compare through the same JS representation as admin versions; PostgreSQL keeps microseconds.
        if (current?.updated_at.toISOString() === document.version) await tx`UPDATE codex_monitor_documents SET status='failed', review_reason=${failureCode(error)}, updated_at=clock_timestamp() WHERE id=${row.id}`;
      });
      failed++;
      break; // Later confirmations may depend on this statement; preserve processing order.
    }
  }
  const [pending] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM codex_monitor_documents WHERE is_current AND source_key IN ${sql(active.map((source) => source.id))} AND status IN ('pending','failed','review')`;
  const enabled = sources.filter((source) => source.enabled);
  const complete = !pending.count && !failed && enabled.length > 0 && (!opts.officialOnly || enabled.every((source) => source.kind !== "x_search")) && enabled.every((source) => states.get(source.id)?.status === "ok" && !states.get(source.id)?.backlog && !states.get(source.id)?.dropped);
  const patch = { lastProcessedAt: new Date().toISOString(), ...(complete ? { lastCompleteAt: new Date().toISOString() } : {}) };
  await sql`INSERT INTO codex_monitor_state (key,value) VALUES ('announcement-review',${sql.json(patch)}) ON CONFLICT (key) DO UPDATE SET value=codex_monitor_state.value || EXCLUDED.value, updated_at=clock_timestamp()`;
  return { skipped: false, processed, failed, review };
}

/** Scheduled and explicitly queued scans share the same PostgreSQL session lock. */
export async function monitorTick(opts: { mode?: "collect" | "process" | "run"; officialOnly?: boolean; limit?: number } = {}) {
  if (!collectionEnabled()) return { skipped: true, reason: "collection_disabled" };
  const connection = await sql.reserve();
  try {
    const [lock] = await connection<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(hashtext('codex-monitor.scan')) AS locked`;
    if (!lock.locked) return { skipped: true, reason: "scan_running" };
    try { return { collection: opts.mode === "process" ? null : await collectAnnouncements(opts), recognition: opts.mode === "collect" ? null : await processAnnouncements(opts.limit ?? 20, opts) }; }
    finally { await connection`SELECT pg_advisory_unlock(hashtext('codex-monitor.scan'))`; }
  } finally { connection.release(); }
}
