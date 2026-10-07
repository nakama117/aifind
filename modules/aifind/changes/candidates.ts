import { randomUUID } from "node:crypto";
import { sql } from "@aihot/backend/db";
import type { Db, Tx } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import { ActionSchema, CandidateSchema, QueueListSchema } from "../admin/contracts.ts";
import type { Candidate, CandidateDetail, CandidateList } from "../admin/contracts.ts";
import { InvalidInput, NotFound } from "../admin/errors.ts";
import { readProducts } from "../catalog/read.ts";
import type { VersionRow } from "../catalog/read.ts";
import { evidenceDto } from "../catalog/evidence.ts";
import type { EvidenceRow } from "../catalog/evidence.ts";
import { normalizeProposal, targetValue, sameTarget, validateTarget } from "./targets.ts";

export interface CandidateRow {
  id: string; product_id: string; base_version_id: string; candidate_type: Candidate["candidateType"]; target_key: string; target_ref: string | null;
  proposed_value: Record<string, unknown>; evidence_id: string; source_type: Candidate["sourceType"]; status: Candidate["status"];
  created_at: Date; reviewed_at: Date | null; reviewed_by: string | null; review_reason: string | null; applied_at: Date | null; applied_version_id: string | null;
  observation_id?: string; source_url?: string; resolver_method?: string; resolver_version?: string; detector_version?: string; prompt_version?: string;
  resolver_receipt_id?: number | null; detector_receipt_id?: number | null; proposal_key?: string;
}
export const candidateDto = (r: CandidateRow): Candidate => ({ id: r.id, productId: r.product_id, baseVersionId: r.base_version_id,
  candidateType: r.candidate_type, targetKey: r.target_key, targetRef: r.target_ref, proposedValue: r.proposed_value,
  evidenceId: r.evidence_id, sourceType: r.source_type, status: r.status, createdAt: r.created_at.toISOString(),
  reviewedAt: r.reviewed_at?.toISOString() ?? null, reviewedBy: r.reviewed_by, reviewReason: r.review_reason,
  appliedAt: r.applied_at?.toISOString() ?? null, appliedVersionId: r.applied_version_id,
  ...(r.source_type === 'detector' ? { detector: { observationId: r.observation_id!, sourceUrl: r.source_url!, resolverMethod: r.resolver_method!,
    resolverVersion: r.resolver_version!, detectorVersion: r.detector_version!, promptVersion: r.prompt_version!,
    resolverReceiptId: r.resolver_receipt_id ?? null, detectorReceiptId: r.detector_receipt_id ?? null, proposalKey: r.proposal_key! } } : {}) });

export async function lockCandidateProduct(tx: Tx, id: string) {
  const [p] = await tx`SELECT id FROM af_products WHERE id=${id} FOR UPDATE`;
  if (!p) throw new NotFound("製品が見つかりません。");
}
export async function lockCandidate(tx: Tx, id: string): Promise<CandidateRow> {
  const [candidate] = await tx<CandidateRow[]>`SELECT * FROM af_product_change_candidates WHERE id=${id} FOR UPDATE`;
  if (!candidate) throw new NotFound("Candidate が見つかりません。");
  return candidate;
}
export async function candidateProductId(db: Db, id: string): Promise<string> {
  const [c] = await db`SELECT product_id FROM af_product_change_candidates WHERE id=${id}`;
  if (!c) throw new NotFound("Candidate が見つかりません。");
  return c.product_id;
}

export async function createCandidate(input: unknown, actor: string): Promise<Candidate> {
  const c = CandidateSchema.parse(input);
  return sql.begin("isolation level read committed", async tx => {
    await lockCandidateProduct(tx, c.productId);
    const [v] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${c.productId} AND status='published'`;
    if (!v || v.id !== c.baseVersionId) throw new Conflict("基準 Published は更新されています。最新の内容から提案を作成してください。");
    if (!(await tx`SELECT id FROM af_evidence WHERE id=${c.evidenceId}`).length) throw new InvalidInput("Evidence が見つかりません。");
    validateTarget((await readProducts(tx, [v]))[0], { ...c, targetRef: c.targetRef ?? null });
    const [r] = await tx<CandidateRow[]>`INSERT INTO af_product_change_candidates
      (id,product_id,base_version_id,candidate_type,target_key,target_ref,proposed_value,evidence_id,source_type)
      VALUES (${randomUUID()},${c.productId},${c.baseVersionId},${c.candidateType},${c.targetKey},${c.targetRef ?? null},
        ${tx.json(normalizeProposal(c) as never)},${c.evidenceId},'manual') RETURNING *`;
    const result = candidateDto(r);
    await audit(actor, "aifind.candidate.create", `aifind:candidate:${r.id}`, c.reason, null, result, { db: tx });
    return result;
  });
}

export async function candidateDetail(db: Db, r: CandidateRow): Promise<CandidateDetail> {
  const candidate = candidateDto(r);
  const versions = await db<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${r.product_id}
    AND (id=${r.base_version_id} OR status IN ('published','draft')) ORDER BY version_no`;
  const snapshots = await readProducts(db, versions);
  const base = snapshots.find(v => v.version.id === r.base_version_id)!;
  const current = snapshots.find(v => v.version.status === "published") ?? null;
  const draft = snapshots.find(v => v.version.status === "draft") ?? null;
  const baseValue = await targetValue(db, base, candidate), currentValue = await targetValue(db, current, candidate), draftValue = await targetValue(db, draft, candidate);
  const [e] = await db<EvidenceRow[]>`SELECT * FROM af_evidence WHERE id=${r.evidence_id}`;
  const [context]=r.source_type==='detector'?await db`SELECT * FROM af_observation_evidence_context WHERE evidence_id=${r.evidence_id}`:[];
  const support=await db`SELECT e.*,s.linked_at,x.context_before,x.context_after,x.retained_input_hash,x.source_length
    FROM af_candidate_supporting_evidence s JOIN af_evidence e ON e.id=s.evidence_id
    LEFT JOIN af_observation_evidence_context x ON x.evidence_id=e.id WHERE s.candidate_id=${r.id} ORDER BY e.retrieved_at,e.id`;
  const supportingEvidence=support.map(e=>({evidence:evidenceDto(e as unknown as EvidenceRow),observationId:e.observation_id??null,primary:e.id===r.evidence_id,linkedAt:e.linked_at.toISOString(),
    context:e.evidence_quote?{quote:e.evidence_quote,start:e.locator_start,end:e.locator_end,contextBefore:e.context_before??'',contextAfter:e.context_after??'',retainedInputHash:e.retained_input_hash??'',sourceLength:e.source_length??0}:null}));
  let conflict = null;
  if (candidate.status !== "applied") {
    if (current?.version.id !== candidate.baseVersionId) conflict = "基準 Published は更新されています。提案を再確認してください。";
    else if (draft && (versions.find(v => v.id === draft.version.id)!.base_version_id !== candidate.baseVersionId || !sameTarget(baseValue, draftValue)))
      conflict = "Draft の対象フィールドは変更されています。自動的には上書きできません。";
  }
  return { candidate, productName: base.identity.canonicalName, currentPublishedVersionId: current?.version.id ?? null,
    baseValue, currentValue, draftValue, evidence: evidenceDto(e), conflict, supportingEvidence,
    ...(r.source_type === 'detector' && e.evidence_quote ? { detectorEvidence: { quote: e.evidence_quote, start: e.locator_start!, end: e.locator_end!,
      contextBefore:context?.context_before??'',contextAfter:context?.context_after??'',retainedInputHash:context?.retained_input_hash??'',sourceLength:context?.source_length??0 } } : {}) };
}
export async function readCandidate(id: string): Promise<CandidateDetail> {
  return sql.begin("isolation level repeatable read read only", async tx => {
    const [r] = await tx<CandidateRow[]>`SELECT * FROM af_product_change_candidates WHERE id=${id}`;
    if (!r) throw new NotFound("Candidate が見つかりません。");
    return candidateDetail(tx, r);
  });
}
export async function listCandidates(input: unknown = {}): Promise<CandidateList> {
  const { status, q, page } = QueueListSchema.parse(input);
  return sql.begin("isolation level repeatable read read only", async tx => {
    const rows = await tx<CandidateRow[]>`SELECT c.* FROM af_product_change_candidates c JOIN af_products p ON p.id=c.product_id
      WHERE ${status === "all" ? tx`TRUE` : tx`c.status=${status}`} AND p.canonical_name ILIKE ${`%${q.replace(/[\\%_]/g, "\\$&")}%`}
      ORDER BY c.created_at DESC,c.id LIMIT 51 OFFSET ${(page - 1) * 50}`;
    const details: CandidateDetail[] = [];
    for (const r of rows.slice(0, 50)) details.push(await candidateDetail(tx, r));
    return { rows: details, page, hasMore: rows.length > 50 };
  });
}
export async function reviewCandidate(id: string, action: "approve" | "reject", input: unknown, actor: string): Promise<Candidate> {
  const { reason } = ActionSchema.parse(input);
  return sql.begin("isolation level read committed", async tx => {
    await lockCandidateProduct(tx, await candidateProductId(tx, id));
    const before = await lockCandidate(tx, id);
    if (before.status !== "pending_review") throw new Conflict("この Candidate は既にレビューされています。最新の状態を再読み込みしてください。");
    const [r] = await tx<CandidateRow[]>`UPDATE af_product_change_candidates SET status=${action === "approve" ? "approved" : "rejected"},
      reviewed_at=clock_timestamp(),reviewed_by=${actor},review_reason=${reason} WHERE id=${id} RETURNING *`;
    const result = candidateDto(r);
    await audit(actor, `aifind.candidate.${action}`, `aifind:candidate:${id}`, reason, candidateDto(before), result, { db: tx });
    return result;
  });
}
