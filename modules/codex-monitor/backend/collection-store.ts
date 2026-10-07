import { sql, type Db } from "@aihot/backend/db";
import { DEFAULT_COLLECTION_SOURCES, type CollectionSource, type SourceContext, type SourceState, type StoredDocument, type Recognition, type KnownEvent } from "./collection-schema.ts";
import type { ResetEventInput } from "../contracts.ts";

export async function collectionSettings(db: Db = sql) {
  const [row] = await db<{ value: { sources: CollectionSource[] }; updated_at: Date }[]>`SELECT value, updated_at FROM codex_monitor_state WHERE key='collection-settings'`;
  return { sources: row?.value.sources ?? DEFAULT_COLLECTION_SOURCES, version: row?.updated_at.toISOString() ?? null };
}
export async function sourceStates(db: Db = sql) {
  const states = await db<{ key: string; value: SourceState }[]>`SELECT key, value FROM codex_monitor_state WHERE key LIKE 'announcement:%'`;
  return new Map(states.map((state) => [state.key.slice("announcement:".length), state.value]));
}
export interface DocumentRow {
  id: string; document_key: string; source_key: string; url: string; author: string; body_text: string;
  published_at: Date | null; observed_at: Date; context: SourceContext[]; status: StoredDocument["status"];
  recognition: Recognition | null; receipt_id: number | null; applied_ids: string[]; review_reason: string | null; updated_at: Date;
}
export function asDocument(row: DocumentRow): StoredDocument {
  return { id: row.id, key: row.document_key, sourceKey: row.source_key, url: row.url, author: row.author, text: row.body_text, publishedAt: row.published_at?.toISOString() ?? null, observedAt: row.observed_at.toISOString(), context: row.context,
    status: row.status, recognition: row.recognition, receiptId: row.receipt_id, appliedIds: row.applied_ids, reviewReason: row.review_reason, version: row.updated_at.toISOString() };
}
export async function existingEvents(db: Db = sql): Promise<KnownEvent[]> {
  const rows = await db<{ body: ResetEventInput; withdrawn: boolean; managed_by: "manual" | "automatic" }[]>`SELECT body, withdrawn, managed_by FROM codex_monitor_events ORDER BY updated_at DESC LIMIT 200`;
  return rows.map((row) => ({ ...row.body, withdrawn: row.withdrawn, managedBy: row.managed_by }));
}
