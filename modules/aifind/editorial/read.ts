import { sql, type Tx } from '@aihot/backend/db';
import { NotFound } from '../admin/errors.ts';
import { EditorialContentSchema, type EditorialAdminDetail, type EditorialRevision, type EditorialType, type EditorialProductChoice } from './contracts.ts';
import { readGuides } from './guides.ts';

export interface EditorialRow { id: string; doc_type: EditorialType; state: EditorialAdminDetail['state']; revision: number; draft_revision_id: string | null; published_revision_id: string | null; public_slug: string | null; created_at: Date; first_published_at: Date | null }
/** All structured relations are read in batches, including historical reference metadata. */
export async function readEditorialRevisions(tx: Tx, ids: string[]): Promise<EditorialRevision[]> {
  if (!ids.length) return [];
  const rows = await tx`SELECT r.*,d.doc_type FROM af_editorial_revisions r JOIN af_editorial_documents d ON d.id=r.document_id WHERE r.id IN ${tx(ids)} ORDER BY r.revision_no`;
  const compare = await tx`SELECT * FROM af_comparisons WHERE revision_id IN ${tx(ids)}`;
  const cp = await tx`SELECT * FROM af_comparison_products WHERE revision_id IN ${tx(ids)} ORDER BY position`;
  const records = await tx`SELECT * FROM af_comparison_test_records WHERE revision_id IN ${tx(ids)}`;
  const categories = await tx`SELECT * FROM af_categories WHERE revision_id IN ${tx(ids)}`;
  const catp = await tx`SELECT * FROM af_category_products WHERE revision_id IN ${tx(ids)} ORDER BY position`;
  const guides = rows.some(r => r.doc_type === 'guide') ? await readGuides(tx, ids) : new Map();
  return rows.map(r => {
    const common = { type: r.doc_type, slug: r.slug, title: r.title, excerpt: r.excerpt, bodyMd: r.body_md, seoTitle: r.seo_title, seoDescription: r.seo_description };
    const c = compare.find(c => c.revision_id === r.id), cat = categories.find(c => c.revision_id === r.id);
    const content = EditorialContentSchema.parse(r.doc_type === 'comparison' ? { ...common, comparison: { mode: c!.mode, question: c!.question, purpose: c!.purpose, methodologyMd: c!.methodology_md,
      verdictMd: c!.verdict_md, goodForMd: c!.good_for_md, notForMd: c!.not_for_md, incomparableConditionsMd: c!.incomparable_conditions_md, limitationsMd: c!.limitations_md,
      products: cp.filter(p => p.revision_id === r.id).map(p => { const t = records.find(t => t.revision_id === r.id && t.product_id === p.product_id);
        return { productId: p.product_id, position: p.position, referencePublishedVersionId: p.reference_version_id, testedPlanKey: p.tested_plan_key, testedPriceRef: p.tested_price_ref,
          testRecord: t ? { task: t.task, environmentMd: t.environment_md, procedureMd: t.procedure_md, resultMd: t.result_md, limitationsMd: t.limitations_md, testedAt: t.tested_at.toISOString(), reviewer: t.reviewer, repeatCount: t.repeat_count, errorCriteria: t.error_criteria } : null }; }) } }
      : r.doc_type === 'guide' ? { ...common, guide: guides.get(r.id) } : { ...common, category: { question: cat!.question, selectionCriteriaMd: cat!.selection_criteria_md, limitationsMd: cat!.limitations_md,
        products: catp.filter(p => p.revision_id === r.id).map(p => ({ productId: p.product_id, position: p.position, referencePublishedVersionId: p.reference_version_id,
          fitSummaryJa: p.fit_summary_ja, notForSummaryJa: p.not_for_summary_ja, selectionNote: p.selection_note })) } });
    return { id: r.id, revisionNo: r.revision_no, content, editor: r.editor, reason: r.reason, createdAt: r.created_at.toISOString(), publishedAt: r.published_at?.toISOString() ?? null };
  });
}
export async function readEditorialAdminIn(tx: Tx, id: string): Promise<EditorialAdminDetail> {
  const [d] = await tx<EditorialRow[]>`SELECT * FROM af_editorial_documents WHERE id=${id}`; if (!d) throw new NotFound('編集ドキュメントが見つかりません。');
  const ids = (await tx`SELECT id FROM af_editorial_revisions WHERE document_id=${id} ORDER BY revision_no`).map(r => r.id as string);
  const history = await readEditorialRevisions(tx, ids);
  const claims=await tx`SELECT slug,claimed_at FROM af_editorial_slug_claims WHERE document_id=${id} ORDER BY claimed_at,slug`;
  return { id: d.id, type: d.doc_type, state: d.state, revision: d.revision, publicSlug: d.public_slug, createdAt: d.created_at.toISOString(), firstPublishedAt: d.first_published_at?.toISOString() ?? null,
    draft: history.find(r => r.id === d.draft_revision_id) ?? null, published: history.find(r => r.id === d.published_revision_id) ?? null, history,
    slugHistory:claims.map(r=>({slug:r.slug as string,claimedAt:r.claimed_at.toISOString()})) };
}
export const readEditorialAdmin = (id: string) => sql.begin('isolation level repeatable read read only', tx => readEditorialAdminIn(tx, id));
export interface EditorialAdminRow { id:string; state:string; revision:number; public_slug:string|null; title:string; draft_revision_no:number|null; published_revision_no:number|null }
export function listEditorialAdmin(type: EditorialType): Promise<EditorialAdminRow[]> {
  return sql.begin('isolation level repeatable read read only', async tx => await tx`SELECT d.id,d.state,d.revision,d.public_slug,
    coalesce(r.title,p.title,'') AS title,r.revision_no AS draft_revision_no,p.revision_no AS published_revision_no
    FROM af_editorial_documents d LEFT JOIN af_editorial_revisions r ON r.id=d.draft_revision_id LEFT JOIN af_editorial_revisions p ON p.id=d.published_revision_id
    WHERE d.doc_type=${type} ORDER BY d.created_at DESC,d.id LIMIT 100`) as Promise<EditorialAdminRow[]>;
}
export function editorialProductChoices(): Promise<EditorialProductChoice[]> {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const rows = await tx`SELECT p.id,p.canonical_name,p.slug,p.public_visibility,v.id AS version_id,v.version_no,v.published_at
      FROM af_products p JOIN af_product_versions v ON v.product_id=p.id WHERE v.published_at IS NOT NULL
      ORDER BY p.canonical_name,p.id,v.version_no DESC LIMIT 1000`;
    const choices = new Map<string, EditorialProductChoice>();
    for (const r of rows) { if (!choices.has(r.id)) choices.set(r.id, { productId: r.id, name: r.canonical_name, slug: r.slug, visibility: r.public_visibility, versions: [] });
      choices.get(r.id)!.versions.push({ id: r.version_id, versionNo: r.version_no, publishedAt: r.published_at.toISOString() }); }
    return [...choices.values()];
  }) as Promise<EditorialProductChoice[]>;
}
