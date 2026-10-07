import { tag } from '../../../tests/setup.ts';
import { publicFixture } from './public-fixtures.ts';
import type { EditorialContent } from '../editorial/contracts.ts';

export const editorialActor = 'synthetic-editorial-human';
export const editorialReason = '[SYNTHETIC] Human editorial test action';
export async function editorialContent(type: 'comparison' | 'category' = 'comparison', count = type === 'comparison' ? 2 : 3, setup?: Parameters<typeof publicFixture>[1]) {
  const products = [];
  for (let i = 0; i < count; i++) products.push(await publicFixture('listed', setup));
  const common = { type, slug: `synthetic-editorial-${tag()}`, title: '[TEST] 日語の資料整理をどう選ぶ？',
    excerpt: '共通の資料整理タスクで条件と限界を比べます。', bodyMd: '## 比較する条件\n予算と入力資料の条件を揃えて判断します。', seoTitle: '', seoDescription: '' };
  const refs = products.map((p, i) => ({ productId: p.product.id, position: i + 1, referencePublishedVersionId: p.published.version.id }));
  const content: EditorialContent = type === 'comparison' ? { ...common, type, comparison: { mode: 'official_sources',
    question: '日語の資料整理で何を確認すべきか？', purpose: '公開資料の範囲を同じ条件で比較する。', methodologyMd: '公式資料の記載を整理し、実測はしていません。',
    verdictMd: '入力条件が合う場合に各候補を検討してください。', goodForMd: '少量の公開資料を扱う人。', notForMd: '未確認の機密情報処理。',
    incomparableConditionsMd: 'プランと利用地域が異なる場合は単純比較できません。', limitationsMd: '公式記載は実行結果を保証しません。', products: refs.map(r => ({ ...r, testedPlanKey: null, testedPriceRef: null, testRecord: null })) } }
    : { ...common, type, category: { question: '日語の資料整理を始めるには？', selectionCriteriaMd: '資料の種類と予算を明示して候補を選びます。', limitationsMd: '掲載順は順位ではなく、全用途を保証しません。',
      products: refs.map(r => ({ ...r, fitSummaryJa: '少量の公開資料を扱う場合。', notForSummaryJa: '機密資料の自動処理には推奨しません。', selectionNote: '入力条件が合うか先に公式情報を確認する。' })) } };
  return { content, products };
}
export function syntheticTestRecord() {
  return { task: '[SYNTHETIC] 自作資料の要約', environmentMd: '[SYNTHETIC] ローカルの検証用環境、実在の製品テストではありません。', procedureMd: '自作の短い資料を入力して結果を記録する。',
    resultMd: '[SYNTHETIC] デモ用の結果記録。実際の性能ではありません。', limitationsMd: '単一の合成試行で一般化できません。', testedAt: '2026-10-06T01:00:00Z', reviewer: '[SYNTHETIC] テスト担当', repeatCount: 1, errorCriteria: '入力にない内容を含むかを確認。' };
}
