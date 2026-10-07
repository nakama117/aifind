import { tag } from '../../../tests/setup.ts';
import { publicFixture } from './public-fixtures.ts';
import { syntheticTestRecord } from './editorial-fixtures.ts';
import { createEditorial, publishEditorial } from '../editorial/documents.ts';
import type { EditorialAdminDetail } from '../editorial/contracts.ts';

export const guideActor = '[SYNTHETIC] Guide test editor';
export const guideReason = '[SYNTHETIC] Explicit human fixture action';
export const guideAction = (d: EditorialAdminDetail) => ({ expectedRevision: d.revision, reason: guideReason });
export const createGuide = (content: unknown) => createEditorial({ content, reason: guideReason }, guideActor);
export const publishGuide = (d: EditorialAdminDetail) => publishEditorial(d.id, guideAction(d), guideActor);
export async function guideFixture(count = 1) {
  const products = [];
  for (let i = 0; i < count; i++) products.push(await publicFixture());
  const refs = products.map((p, i) => ({ productId: p.product.id, position: i + 1,
    role: (i === 0 ? 'primary' : 'alternative') as 'primary' | 'alternative' | 'prerequisite',
    referencePublishedVersionId: p.published.version.id, referencedPlanKey: null as string | null,
    referencedPriceRef: null as string | null,
    testRecord: null as (ReturnType<typeof syntheticTestRecord> & { productId: string; referencePublishedVersionId: string; referencedPlanKey: string | null }) | null }));
  const content = { type: 'guide' as const, slug: 'synthetic-guide-' + tag(), title: '[SYNTHETIC] 自作資料を整理する手順',
    excerpt: '架空の製品と素材を使ったシステム検証用の Guide です。', bodyMd: '公式資料の形式を整理した合成デモです。製品の参照版に記録した出典を示します。', seoTitle: '', seoDescription: '',
    guide: { mode: 'official_sources' as 'official_sources' | 'hands_on', task: '[SYNTHETIC] 自作資料の整理',
      taskResultMd: '自作の短い資料から確認項目を整理します。', prerequisitesMd: '専用の合成テスト用アカウントを用意します。',
      materialsMd: '自作の短い公開資料だけを使い、秘密情報は入力しません。',
      stepsMd: '## 1. 素材を確認する\n資料に秘密情報がないことを確認します。\n\n## 2. 入力する\n自作の資料だけを入力します。\n\n## 3. 結果を確認する\n元の資料と照合します。',
      resultMd: '[SYNTHETIC] 確認項目が得られる形式の例です。実在する製品の結果ではありません。',
      failuresMd: '入力条件が異なると同じ結果を再現できません。', limitationsMd: '合成デモであり、機密資料の安全性や実際の性能は保証しません。',
      costNotesMd: '料金は現在の製品情報と参照版を別々に確認します。換算はしません。', alternativesMd: '同じ資料を人が確認する方法もあります。',
      products: refs, assets: [] as Array<{ assetId: string; role: 'cover' | 'step' | 'result' | 'reference'; position: number; captionJa: string; altJa: string }> } };
  return { content, products };
}
export function guideTestRecord(p: Awaited<ReturnType<typeof guideFixture>>['content']['guide']['products'][number]) {
  return { ...syntheticTestRecord(), productId: p.productId, referencePublishedVersionId: p.referencePublishedVersionId, referencedPlanKey: p.referencedPlanKey };
}
