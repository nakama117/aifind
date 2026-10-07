import { readFileSync } from "node:fs";
import { z } from "zod";
import { sql } from "@aihot/backend/db";
import { audit } from "@aihot/backend/audit";
import { parseHistory, type ChronicleHistory } from "./history.ts";

const bundled = new Map<string, ChronicleHistory>((JSON.parse(readFileSync(new URL("../data/histories.json", import.meta.url), "utf8")) as unknown[])
  .map((value) => { const slug = z.object({ topic: z.string() }).parse(value).topic; return [slug, parseHistory(value, slug)]; }));
const reasonSchema = z.string().trim().min(1).max(500);

interface Stored { topic: string; document: ChronicleHistory; enabled: boolean; updated_at: Date }
export interface HistoryRecord { topic: string; document: ChronicleHistory; enabled: boolean; origin: "bundled" | "imported"; updatedAt: string | null }

export async function listHistories(): Promise<HistoryRecord[]> {
  const rows = await sql<Stored[]>`SELECT topic, document, enabled, updated_at FROM topic_chronicles ORDER BY topic`;
  const records = new Map<string, HistoryRecord>([...bundled].map(([topic, document]) => [topic, { topic, document, enabled: true, origin: "bundled", updatedAt: null }]));
  for (const r of rows) records.set(r.topic, { topic: r.topic, document: parseHistory(r.document, r.topic), enabled: r.enabled, origin: "imported", updatedAt: r.updated_at.toISOString() });
  return [...records.values()].sort((a, b) => a.topic.localeCompare(b.topic));
}

/** Read on every publication request. A stored withdrawal overrides the shipped archive. */
export async function readHistory(slug: string): Promise<ChronicleHistory | null> {
  const [row] = await sql<Stored[]>`SELECT topic, document, enabled, updated_at FROM topic_chronicles WHERE topic = ${slug}`;
  return row ? row.enabled ? parseHistory(row.document, slug) : null : bundled.get(slug) ?? null;
}

export async function saveHistory(value: unknown, actor: string, reason: string): Promise<void> {
  const topic = z.object({ topic: z.string() }).parse(value).topic;
  const document = parseHistory(value, topic);
  reason = reasonSchema.parse(reason);
  await sql.begin(async (tx) => {
    const [before] = await tx`SELECT document, enabled FROM topic_chronicles WHERE topic = ${topic}`;
    await tx`INSERT INTO topic_chronicles (topic, document, enabled) VALUES (${topic}, ${tx.json(document)}, true)
      ON CONFLICT (topic) DO UPDATE SET document = excluded.document, enabled = true, updated_at = now()`;
    await audit(actor, "chronicle.import", `chronicle:${topic}`, reason, before ?? bundled.get(topic) ?? null, { document, enabled: true }, { db: tx });
  });
}

export async function setHistoryEnabled(slug: string, enabled: boolean, actor: string, reason: string): Promise<void> {
  reason = reasonSchema.parse(reason);
  await sql.begin(async (tx) => {
    const [before] = await tx<Stored[]>`SELECT topic, document, enabled, updated_at FROM topic_chronicles WHERE topic = ${slug}`;
    const document = before?.document ?? bundled.get(slug);
    if (!document) throw Object.assign(new Error("年表が見つかりません"), { statusCode: 400 });
    await tx`INSERT INTO topic_chronicles (topic, document, enabled) VALUES (${slug}, ${tx.json(document)}, ${enabled})
      ON CONFLICT (topic) DO UPDATE SET enabled = excluded.enabled, updated_at = now()`;
    await audit(actor, "chronicle.visibility", `chronicle:${slug}`, reason, { enabled: before?.enabled ?? true }, { enabled }, { db: tx });
  });
}
