import type { Tx } from '@aihot/backend/db';
import { productRefs, type EditorialContent } from './contracts.ts';
import { assetPublishIssues } from './assets.ts';

export async function editorialPublishIssues(tx: Tx, c: EditorialContent): Promise<string[]> {
  const issues: string[] = [], required = (value: string, key: string) => { if (!value.trim()) issues.push(`${key}: 必須です。`); };
  required(c.title, 'title'); required(c.excerpt, 'excerpt'); required(c.bodyMd, c.type === 'category' ? 'introMd' : 'bodyMd');
  const refs = productRefs(c), min = c.type === 'comparison' ? 2 : c.type === 'guide' ? 1 : 3, max = c.type === 'category' ? 5 : 3;
  if (refs.length < min || refs.length > max) issues.push(`products: ${min}–${max} 件が必要です。`);
  if (c.type === 'comparison') {
    const p = c.comparison;
    for (const key of ['question','purpose','methodologyMd','verdictMd','goodForMd','notForMd','incomparableConditionsMd','limitationsMd'] as const) required(p[key], key);
    if (p.mode === 'hands_on' && p.products.some(r => !r.testRecord)) issues.push('hands_on: 各製品の実測 Test Record が必要です。');
  } else if (c.type === 'category') {
    required(c.category.question, 'question'); required(c.category.selectionCriteriaMd, 'selectionCriteriaMd'); required(c.category.limitationsMd, 'limitationsMd');
    for (const p of c.category.products) { required(p.fitSummaryJa, 'fitSummaryJa'); required(p.notForSummaryJa, 'notForSummaryJa'); required(p.selectionNote, 'selectionNote'); }
  } else {
    for (const key of ['task','taskResultMd','prerequisitesMd','materialsMd','stepsMd','resultMd','failuresMd','limitationsMd','costNotesMd','alternativesMd'] as const) required(c.guide[key], key);
    const primary = c.guide.products.filter(p => p.role === 'primary');
    if (primary.length !== 1) issues.push('primary: 主製品がちょうど 1 件必要です。');
    if (c.guide.mode === 'hands_on' && !primary[0]?.testRecord) issues.push('hands_on: 主製品の実測 Test Record が必要です。');
    for (const a of c.guide.assets) { required(a.captionJa, 'asset.captionJa'); required(a.altJa, 'asset.altJa'); }
    issues.push(...await assetPublishIssues(c.guide.assets.map(a=>a.assetId),tx));
  }
  if (refs.length) {
    const eligible = await tx`SELECT p.id FROM af_products p JOIN af_product_versions v ON v.product_id=p.id WHERE p.id IN ${tx(refs.map(p => p.productId))}
      AND p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v)`;
    const ids = new Set(eligible.map(r => r.id));
    for (const p of refs) if (!ids.has(p.productId)) issues.push(`product:${p.productId}: listed / Published / public-ready が必要です。`);
  }
  return issues;
}
