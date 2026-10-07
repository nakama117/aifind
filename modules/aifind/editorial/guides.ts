import type { Tx } from '@aihot/backend/db';
import type { GuideContent } from './contracts.ts';
import { syncGuideAssets } from './assets.ts';

export async function writeGuide(tx: Tx, revisionId: string, g: GuideContent, actor: string, reason: string) {
  await tx`DELETE FROM af_guide_test_records WHERE revision_id=${revisionId}`;
  await tx`DELETE FROM af_guide_products WHERE revision_id=${revisionId}`;
  await tx`INSERT INTO af_guides(revision_id,mode,task,task_result_md,prerequisites_md,materials_md,steps_md,result_md,failures_md,limitations_md,cost_notes_md,alternatives_md)
    VALUES (${revisionId},${g.mode},${g.task},${g.taskResultMd},${g.prerequisitesMd},${g.materialsMd},${g.stepsMd},${g.resultMd},${g.failuresMd},${g.limitationsMd},${g.costNotesMd},${g.alternativesMd})
    ON CONFLICT(revision_id) DO UPDATE SET mode=EXCLUDED.mode,task=EXCLUDED.task,task_result_md=EXCLUDED.task_result_md,prerequisites_md=EXCLUDED.prerequisites_md,
      materials_md=EXCLUDED.materials_md,steps_md=EXCLUDED.steps_md,result_md=EXCLUDED.result_md,failures_md=EXCLUDED.failures_md,limitations_md=EXCLUDED.limitations_md,cost_notes_md=EXCLUDED.cost_notes_md,alternatives_md=EXCLUDED.alternatives_md`;
  for (const p of g.products) {
    await tx`INSERT INTO af_guide_products(revision_id,product_id,position,role,reference_version_id,referenced_plan_key,referenced_price_ref)
      VALUES (${revisionId},${p.productId},${p.position},${p.role},${p.referencePublishedVersionId},${p.referencedPlanKey},${p.referencedPriceRef})`;
    const t = p.testRecord;
    if (t) await tx`INSERT INTO af_guide_test_records(revision_id,product_id,reference_version_id,referenced_plan_key,task,environment_md,procedure_md,result_md,limitations_md,tested_at,reviewer,repeat_count,error_criteria)
      VALUES (${revisionId},${t.productId},${t.referencePublishedVersionId},${t.referencedPlanKey},${t.task},${t.environmentMd},${t.procedureMd},${t.resultMd},${t.limitationsMd},${t.testedAt},${t.reviewer},${t.repeatCount},${t.errorCriteria})`;
  }
  await syncGuideAssets(tx, revisionId, g.assets, actor, reason);
}

export async function readGuides(tx: Tx, ids: string[]): Promise<Map<string, GuideContent>> {
  const rows = await tx`SELECT * FROM af_guides WHERE revision_id IN ${tx(ids)}`;
  const refs = await tx`SELECT * FROM af_guide_products WHERE revision_id IN ${tx(ids)} ORDER BY position`;
  const records = await tx`SELECT * FROM af_guide_test_records WHERE revision_id IN ${tx(ids)}`;
  const assets = await tx`SELECT * FROM af_editorial_revision_assets WHERE revision_id IN ${tx(ids)} ORDER BY position`;
  return new Map(rows.map(g => [g.revision_id, { mode: g.mode, task: g.task, taskResultMd: g.task_result_md, prerequisitesMd: g.prerequisites_md, materialsMd: g.materials_md,
    stepsMd: g.steps_md, resultMd: g.result_md, failuresMd: g.failures_md, limitationsMd: g.limitations_md, costNotesMd: g.cost_notes_md, alternativesMd: g.alternatives_md,
    products: refs.filter(p => p.revision_id === g.revision_id).map(p => { const t = records.find(t => t.revision_id === g.revision_id && t.product_id === p.product_id);
      return { productId: p.product_id, position: p.position, role: p.role, referencePublishedVersionId: p.reference_version_id, referencedPlanKey: p.referenced_plan_key, referencedPriceRef: p.referenced_price_ref,
        testRecord: t ? { productId: t.product_id, referencePublishedVersionId: t.reference_version_id, referencedPlanKey: t.referenced_plan_key, task: t.task, environmentMd: t.environment_md, procedureMd: t.procedure_md,
          resultMd: t.result_md, limitationsMd: t.limitations_md, testedAt: t.tested_at.toISOString(), reviewer: t.reviewer, repeatCount: t.repeat_count, errorCriteria: t.error_criteria } : null }; }),
    assets: assets.filter(a=>a.revision_id===g.revision_id).map(a=>({assetId:a.asset_id,role:a.role,position:a.position,captionJa:a.caption_ja,altJa:a.alt_ja})) } as GuideContent]));
}
