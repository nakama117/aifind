import { sql } from "@aihot/backend/db";
import { audit, Conflict } from "@aihot/backend/audit";
import { ActionSchema } from "../admin/contracts.ts";
import type { ApplyResult } from "../admin/contracts.ts";
import { readProducts } from "../catalog/read.ts";
import type { VersionRow } from "../catalog/read.ts";
import { clonePublishedProduct } from "../catalog/versions.ts";
import { candidateProductId, candidateDto, lockCandidateProduct, lockCandidate } from "./candidates.ts";
import { targetValue, sameTarget, applyTarget } from "./targets.ts";

/** Product lock serializes publication, edits and candidate application; everything commits together. */
export async function applyCandidate(id: string, input: unknown, actor: string): Promise<ApplyResult> {
  const { reason } = ActionSchema.parse(input);
  return sql.begin("isolation level read committed", async tx => {
    const productId = await candidateProductId(tx, id);
    await lockCandidateProduct(tx, productId);
    const row = await lockCandidate(tx, id), c = candidateDto(row);
    if (c.status === "applied") return { candidateId: id, status: "applied", draftVersionId: c.appliedVersionId!, alreadyApplied: true };
    if (c.status !== "approved") throw new Conflict("承認済みの Candidate だけを Draft に適用できます。");
    const [pub] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} AND status='published'`;
    if (!pub || pub.id !== c.baseVersionId) throw new Conflict("基準 Published は更新されています。提案を再確認してください。");
    const [draft] = await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${productId} AND status='draft' FOR UPDATE`;
    if (draft) {
      if (draft.base_version_id !== c.baseVersionId) throw new Conflict("Draft の基準 Published が一致しません。自動的には上書きできません。");
      const [baseSnapshot, draftSnapshot] = await readProducts(tx, [pub, draft]);
      if (!sameTarget(await targetValue(tx, baseSnapshot, c), await targetValue(tx, draftSnapshot, c)))
        throw new Conflict("Draft の対象フィールドは変更されています。自動的には上書きできません。");
    }
    const versionId = draft?.id ?? (await clonePublishedProduct(productId, actor, tx)).version.id;
    if (!draft) await audit(actor, "aifind.draft.create", `aifind:product:${productId}`, reason, { baseVersionId: pub.id }, { versionId }, { db: tx });
    // Detector retrieval is not verification. Only the recorded human approval supplies this time.
    const verified = c.sourceType === 'detector' ? { ...c, proposedValue: { ...c.proposedValue,
      [c.candidateType === 'lifecycle' ? 'lifecycleVerifiedAt' : 'verifiedAt']: c.reviewedAt } } : c;
    await applyTarget(tx, productId, versionId, verified);
    await tx`UPDATE af_product_change_candidates SET status='applied',applied_at=clock_timestamp(),applied_version_id=${versionId} WHERE id=${id}`;
    const result: ApplyResult = { candidateId: id, status: "applied", draftVersionId: versionId, alreadyApplied: false };
    await audit(actor, "aifind.candidate.apply", `aifind:candidate:${id}`, reason, c, result, { db: tx });
    return result;
  });
}
