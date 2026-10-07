import { sql, type Db, type Tx } from "@aihot/backend/db";
import { newUuid } from "@aihot/backend/lib/ids";
import { EvidenceSchema } from "../contracts.ts";
import type { Evidence } from "../contracts.ts";

export interface EvidenceRow {
  id: string; url: string; title: string | null; publisher: string | null; source_kind: Evidence["sourceKind"];
  retrieved_at: Date; published_at: Date | null; content_hash: string | null; evidence_note: string | null; created_at: Date;
  evidence_quote?: string | null; locator_start?: number | null; locator_end?: number | null;
}
export const evidenceDto = (r: EvidenceRow): Evidence => ({
  id: r.id, url: r.url, title: r.title, publisher: r.publisher, sourceKind: r.source_kind,
  retrievedAt: r.retrieved_at.toISOString(), publishedAt: r.published_at?.toISOString() ?? null,
  contentHash: r.content_hash, evidenceNote: r.evidence_note, createdAt: r.created_at.toISOString(),
});

/** Evidence records are metadata plus a short note; corrections create a new record. */
export async function createEvidence(input: unknown, db: Db = sql,
  provenance?: { observationId: string; quote: string; start: number; end: number }): Promise<Evidence> {
  const e = EvidenceSchema.parse(input);
  const [row] = await db<EvidenceRow[]>`INSERT INTO af_evidence (id, url, title, publisher, source_kind, retrieved_at,
    published_at, content_hash, evidence_note, observation_id, evidence_quote, locator_start, locator_end)
    VALUES (${newUuid()}, ${e.url}, ${e.title ?? null}, ${e.publisher ?? null},
    ${e.sourceKind}, ${e.retrievedAt}, ${e.publishedAt ?? null}, ${e.contentHash?.toLowerCase() ?? null}, ${e.evidenceNote ?? null},
    ${provenance?.observationId ?? null}, ${provenance?.quote ?? null}, ${provenance?.start ?? null}, ${provenance?.end ?? null}) RETURNING *`;
  if(provenance){
    const contexts=await db`INSERT INTO af_observation_evidence_context
      SELECT ${row.id},o.id,${provenance.quote},substring(o.source_text FROM greatest(1,${provenance.start}-159) FOR least(160,${provenance.start})),
        substring(o.source_text FROM ${provenance.end}+1 FOR 160),${provenance.start},${provenance.end},length(o.source_text),
        encode(sha256(convert_to(o.source_text,'UTF8')),'hex'),o.content_hash
      FROM af_source_observations o WHERE o.id=${provenance.observationId} RETURNING evidence_id`;
    if(contexts.length!==1)throw new Error('Observation context unavailable');
  }
  return evidenceDto(row);
}
export async function getEvidence(id: string): Promise<Evidence | null> {
  const [row] = await sql<EvidenceRow[]>`SELECT id, url, title, publisher, source_kind, retrieved_at, published_at,
    content_hash, evidence_note, created_at FROM af_evidence WHERE id=${id}`;
  return row ? evidenceDto(row) : null;
}
