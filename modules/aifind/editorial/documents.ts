import { type Tx } from '@aihot/backend/db';
import { audit, Conflict } from '@aihot/backend/audit';
import { newUuid } from '@aihot/backend/lib/ids';
import { PublishAuditSchema } from '../contracts.ts';
import { NotFound } from '../admin/errors.ts';
import { adminTransaction } from '../admin/products.ts';
import { EditorialCreateSchema, EditorialSaveSchema, EditorialActionSchema, EditorialRestoreSchema, EditorialPublicationError, productRefs, type EditorialContent } from './contracts.ts';
import { readEditorialAdminIn, type EditorialRow } from './read.ts';
import { editorialPublishIssues } from './validation.ts';
import { writeGuide } from './guides.ts';

async function lock(tx: Tx, id: string, expected: number) {
  const [d] = await tx<EditorialRow[]>`SELECT * FROM af_editorial_documents WHERE id=${id} FOR UPDATE`;
  if (!d) throw new NotFound('編集ドキュメントが見つかりません。');
  if (d.revision !== expected) throw new Conflict('編集 revision は更新されています。最新の内容を再読み込みしてください。');
  return d;
}
async function record(tx: Tx, id: string, actor: string, action: string, reason: string, before: unknown) {
  const result = await readEditorialAdminIn(tx, id);
  await audit(actor, 'aifind.editorial.' + action, 'aifind:editorial:' + id, reason, before,
    { revision: result.revision, draftRevisionId: result.draft?.id ?? null, publishedRevisionId: result.published?.id ?? null, state: result.state }, { db: tx });
  return result;
}
async function writeContent(tx: Tx, revisionId: string, c: EditorialContent, actor: string, reason: string) {
  await tx`UPDATE af_editorial_revisions SET slug=${c.slug},title=${c.title},excerpt=${c.excerpt},body_md=${c.bodyMd},seo_title=${c.seoTitle},seo_description=${c.seoDescription} WHERE id=${revisionId}`;
  // Replace only this mutable Draft's typed relations. Historical Published rows are DB protected.
  if (c.type === 'comparison') {
    await tx`DELETE FROM af_comparison_test_records WHERE revision_id=${revisionId}`;
    await tx`DELETE FROM af_comparison_products WHERE revision_id=${revisionId}`;
    await tx`DELETE FROM af_comparisons WHERE revision_id=${revisionId}`;
    const v = c.comparison;
    await tx`INSERT INTO af_comparisons(revision_id,mode,question,purpose,methodology_md,verdict_md,good_for_md,not_for_md,incomparable_conditions_md,limitations_md)
      VALUES (${revisionId},${v.mode},${v.question},${v.purpose},${v.methodologyMd},${v.verdictMd},${v.goodForMd},${v.notForMd},${v.incomparableConditionsMd},${v.limitationsMd})`;
    for (const p of v.products) {
      await tx`INSERT INTO af_comparison_products(revision_id,product_id,position,reference_version_id,tested_plan_key,tested_price_ref)
        VALUES (${revisionId},${p.productId},${p.position},${p.referencePublishedVersionId},${p.testedPlanKey},${p.testedPriceRef})`;
      const t = p.testRecord;
      if (t) await tx`INSERT INTO af_comparison_test_records(revision_id,product_id,task,environment_md,procedure_md,result_md,limitations_md,tested_at,reviewer,repeat_count,error_criteria)
        VALUES (${revisionId},${p.productId},${t.task},${t.environmentMd},${t.procedureMd},${t.resultMd},${t.limitationsMd},${t.testedAt},${t.reviewer},${t.repeatCount},${t.errorCriteria})`;
    }
  } else if (c.type === 'category') {
    await tx`DELETE FROM af_category_products WHERE revision_id=${revisionId}`; await tx`DELETE FROM af_categories WHERE revision_id=${revisionId}`;
    const v = c.category;
    await tx`INSERT INTO af_categories(revision_id,question,selection_criteria_md,limitations_md) VALUES (${revisionId},${v.question},${v.selectionCriteriaMd},${v.limitationsMd})`;
    for (const p of v.products) await tx`INSERT INTO af_category_products(revision_id,product_id,position,reference_version_id,fit_summary_ja,not_for_summary_ja,selection_note)
      VALUES (${revisionId},${p.productId},${p.position},${p.referencePublishedVersionId},${p.fitSummaryJa},${p.notForSummaryJa},${p.selectionNote})`;
  } else {
    await writeGuide(tx, revisionId, c.guide, actor, reason);
  }
}
async function newDraft(tx: Tx, documentId: string, c: EditorialContent, actor: string, reason: string) {
  const [n] = await tx`SELECT coalesce(max(revision_no),0)+1 AS next FROM af_editorial_revisions WHERE document_id=${documentId}`;
  const id = newUuid();
  await tx`INSERT INTO af_editorial_revisions(id,document_id,revision_no,slug,title,editor,reason) VALUES (${id},${documentId},${n.next},${c.slug},${c.title},${actor},${reason})`;
  await writeContent(tx, id, c, actor, reason);
  await tx`UPDATE af_editorial_documents SET draft_revision_id=${id} WHERE id=${documentId}`;
  return id;
}
export async function createEditorial(input: unknown, actor: string) {
  const p = EditorialCreateSchema.parse(input); PublishAuditSchema.parse({ actor, reason: p.reason });
  return adminTransaction(async tx => {
    const id = newUuid(); await tx`INSERT INTO af_editorial_documents(id,doc_type) VALUES (${id},${p.content.type})`;
    await newDraft(tx, id, p.content, actor, p.reason); return record(tx, id, actor, 'create', p.reason, null);
  });
}
export async function saveEditorialDraft(id: string, input: unknown, actor: string) {
  const p = EditorialSaveSchema.parse(input); PublishAuditSchema.parse({ actor, reason: p.reason });
  return adminTransaction(async tx => {
    const d = await lock(tx, id, p.expectedRevision);
    if (!d.draft_revision_id) throw new Conflict('先に新しい Draft を作成してください。');
    if (d.doc_type !== p.content.type) throw new Conflict('編集ドキュメントの種類は変更できません。');
    await writeContent(tx, d.draft_revision_id, p.content, actor, p.reason);
    await tx`UPDATE af_editorial_revisions SET editor=${actor},reason=${p.reason} WHERE id=${d.draft_revision_id}`;
    await tx`UPDATE af_editorial_documents SET revision=revision+1 WHERE id=${id}`;
    return record(tx, id, actor, 'save', p.reason, { revision: d.revision, draftRevisionId: d.draft_revision_id });
  });
}
export async function createEditorialDraft(id: string, input: unknown, actor: string) {
  const p = EditorialActionSchema.parse(input); PublishAuditSchema.parse({ actor, reason: p.reason });
  return adminTransaction(async tx => {
    const d = await lock(tx, id, p.expectedRevision);
    if (d.draft_revision_id || !d.published_revision_id) throw new Conflict('Draft が既に存在するか、複製元の Published がありません。');
    const before = await readEditorialAdminIn(tx, id); await newDraft(tx, id, before.published!.content, actor, p.reason);
    await tx`UPDATE af_editorial_documents SET revision=revision+1 WHERE id=${id}`;
    return record(tx, id, actor, 'draft', p.reason, { revision: d.revision, sourceRevisionId: d.published_revision_id });
  });
}
export async function publishEditorial(id: string, input: unknown, actor: string) {
  const p = EditorialActionSchema.parse(input); PublishAuditSchema.parse({ actor, reason: p.reason });
  return adminTransaction(async tx => {
    const d = await lock(tx, id, p.expectedRevision);
    if (!d.draft_revision_id) throw new Conflict('公開する Draft がありません。');
    const draft = (await readEditorialAdminIn(tx, id)).draft!;
    const refs = productRefs(draft.content);
    if (refs.length) await tx`SELECT id FROM af_products WHERE id IN ${tx(refs.map(p => p.productId))} ORDER BY id FOR UPDATE`;
    const issues = await editorialPublishIssues(tx, draft.content); if (issues.length) throw new EditorialPublicationError(issues);
    await tx`INSERT INTO af_editorial_slug_claims(doc_type,slug,document_id) VALUES (${d.doc_type},${draft.content.slug},${id}) ON CONFLICT DO NOTHING`;
    const [claim] = await tx`SELECT document_id FROM af_editorial_slug_claims WHERE doc_type=${d.doc_type} AND slug=${draft.content.slug}`;
    if (claim.document_id !== id) throw new Conflict('この slug は別の公開履歴で使用されています。');
    await tx`UPDATE af_editorial_revisions SET published_at=clock_timestamp(),editor=${actor},reason=${p.reason} WHERE id=${draft.id}`;
    await tx`UPDATE af_editorial_documents SET state='published',published_revision_id=${draft.id},draft_revision_id=NULL,public_slug=${draft.content.slug},
      first_published_at=coalesce(first_published_at,clock_timestamp()),revision=revision+1 WHERE id=${id}`;
    return record(tx, id, actor, 'publish', p.reason, { revision: d.revision, publishedRevisionId: d.published_revision_id });
  });
}
export async function withdrawEditorial(id: string, input: unknown, actor: string) {
  const p = EditorialActionSchema.parse(input); PublishAuditSchema.parse({ actor, reason: p.reason });
  return adminTransaction(async tx => {
    const d = await lock(tx, id, p.expectedRevision); if (d.state !== 'published') throw new Conflict('現在公開されていません。');
    await tx`UPDATE af_editorial_documents SET state='withdrawn',revision=revision+1 WHERE id=${id}`;
    return record(tx, id, actor, 'withdraw', p.reason, { revision: d.revision, state: d.state });
  });
}
export async function restoreEditorial(id: string, input: unknown, actor: string) {
  const p = EditorialRestoreSchema.parse(input); PublishAuditSchema.parse({ actor, reason: p.reason });
  return adminTransaction(async tx => {
    const d = await lock(tx, id, p.expectedRevision), detail = await readEditorialAdminIn(tx, id);
    const source = detail.history.find(r => r.id === p.sourceRevisionId);
    if (!source || !source.publishedAt) throw new NotFound('このドキュメントの Published 履歴が見つかりません。');
    await newDraft(tx, id, source.content, actor, p.reason); await tx`UPDATE af_editorial_documents SET revision=revision+1 WHERE id=${id}`;
    return record(tx, id, actor, 'restore', p.reason, { revision: d.revision, sourceRevisionId: source.id, priorDraftRevisionId: d.draft_revision_id });
  });
}
