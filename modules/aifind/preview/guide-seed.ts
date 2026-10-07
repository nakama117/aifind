import { sql } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import sharp from 'sharp';
import { assertPreviewWrites } from './config.ts';
import { seedEditorialPreview } from './editorial-seed.ts';
import { readAdminProduct } from '../admin/read.ts';
import { createEditorial } from '../editorial/documents.ts';
import { uploadEditorialAsset } from '../editorial/assets.ts';
import type { EditorialContent } from '../editorial/contracts.ts';

export const GUIDE_PREVIEW_SLUGS=['aifind-preview-guide-official','aifind-preview-guide-hands-on','aifind-preview-guide-retest','aifind-preview-guide-draft-only'] as const;
export async function syntheticGuideImage():Promise<Buffer>{
  return sharp(Buffer.from('<svg width="900" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="900" height="360" fill="#f0f5fa"/><text x="40" y="65" font-size="32" fill="#15334d">[PREVIEW] [SYNTHETIC]</text><rect x="40" y="110" width="245" height="160" rx="16" fill="#386cb0"/><rect x="325" y="110" width="245" height="160" rx="16" fill="#42876e"/><rect x="610" y="110" width="245" height="160" rx="16" fill="#9c7041"/><g fill="white" font-size="24"><text x="72" y="190">1. Read input</text><text x="354" y="190">2. Review draft</text><text x="643" y="190">3. Check result</text></g><text x="40" y="320" font-size="18" fill="#15334d">Self-created diagram. No real product was tested.</text></svg>')).png().toBuffer();
}
/** Explicit fixture setup only. No Guide publish or rights/privacy review takes place here. */
export async function seedGuidePreview():Promise<void>{
  assertPreviewWrites({...process.env,DATABASE_URL:config.databaseUrl});
  const existing=await sql`SELECT DISTINCT d.id FROM af_editorial_documents d JOIN af_editorial_revisions r ON r.document_id=d.id WHERE r.slug IN ${sql([...GUIDE_PREVIEW_SLUGS])}`;
  if(existing.length){if(existing.length!==4)throw Error('Partial Guide seed: preserve work and use a fresh disposable database');return;}
  await seedEditorialPreview();
  const rows=await sql`SELECT id FROM af_products WHERE slug IN ${sql(['01','03','04','05'].map(n=>'aifind-preview-discovery-'+n))}`;
  const products=await Promise.all(rows.map(r=>readAdminProduct(r.id))),bySlug=new Map(products.map(p=>[p.identity.slug,p]));
  const refs=(numbers:string[])=>numbers.map((n,i)=>{const p=bySlug.get('aifind-preview-discovery-'+n);if(!p?.published)throw Error('Published synthetic Product missing');
    return{productId:p.identity.id,position:i+1,role:i===0?'primary' as const:'alternative' as const,referencePublishedVersionId:p.published.version.id,referencedPlanKey:'demo',referencedPriceRef:null,testRecord:null};});
  const asset=await uploadEditorialAsset({bytes:await syntheticGuideImage(),fileName:'synthetic-guide.png',mime:'image/png',reason:'[SYNTHETIC] Explicit local image fixture upload; reviews remain pending'},'synthetic-preview-editor');
  const common={type:'guide' as const,title:'[PREVIEW] [SYNTHETIC] 自作の短い文章を整理する',excerpt:'手順と条件を確認するための合成デモです。実在製品の利用結果ではありません。',bodyMd:'## 参照資料\n合成 Product Domain の根拠を使用するシステム検証用のページです。実在する公式資料は取得していません。',seoTitle:'',seoDescription:''};
  const guide={mode:'official_sources' as const,task:'[SYNTHETIC] 自作の短い文章を整理する',taskResultMd:'3つの手順で、確認の観点を整理する表示デモです。',prerequisitesMd:'合成 Product の参照 Plan は demo。実際のアカウントや契約は不要です。',materialsMd:'自分で作った短い文章だけを使います。個人情報・秘密・API key を入力しません。\n\n~~~text\n[SYNTHETIC] 今日の作業を三つにまとめる。\n~~~',
    stepsMd:'1. 自作の短い文章を用意する。\n2. 入力条件を確認し、下書きを整理する。\n3. 元の文章と照らして、足りない情報を確認する。\n\n| 確認項目 | 表示例 |\n|---|---|\n| 入力 | 自作の文章 |\n| 出力 | 合成した下書き |',
    resultMd:'[SYNTHETIC] 表示テスト用の結果です。製品を実行した成果物ではありません。',failuresMd:'入力にない情報が追加される形式の失敗例です。元の文章と照合して修正します。',limitationsMd:'合成シナリオなので性能・精度を判断できません。実在する製品へ一般化しません。',
    costNotesMd:'現在の料金は Product Reader から取得します。未確認・無料・固定料金・要問い合わせを区別してください。',alternativesMd:'手作業で整理するか、下に表示する代替 Product の条件を確認します。'};
  for(let i=0;i<4;i++){
    const content:EditorialContent={...common,slug:GUIDE_PREVIEW_SLUGS[i],title:common.title+[' · 公式資料の形式',' · Test Record の形式',' · 再テスト確認',' · Draft 専用'][i],
      guide:{...guide,mode:i===1?'hands_on':'official_sources',products:refs(i===1?['04','05']:['03','01']),assets:i===0||i===3?[{assetId:asset.id,role:'step',position:1,captionJa:'[SYNTHETIC] 自分で作成した三段階の説明図',altJa:'入力の準備、下書きの確認、結果の確認という三段階の合成図'}]:[]}};
    if(content.type==='guide'&&i===1){const p=content.guide.products[0];p.testRecord={productId:p.productId,referencePublishedVersionId:p.referencePublishedVersionId,referencedPlanKey:p.referencedPlanKey,task:'[SYNTHETIC] Test Record 表示の検証',environmentMd:'ローカルの UI 表示テストです。実在製品は使っていません。',procedureMd:'合成入力を表示して、確認項目をチェックする。',resultMd:'[SYNTHETIC] システム検証用の結果です。',limitationsMd:'製品性能を実測した記録ではありません。',testedAt:'2026-10-06T10:00:00+09:00',reviewer:'[SYNTHETIC] Preview 担当者',repeatCount:1,errorCriteria:'表示が揃っているかを確認する。'};}
    await createEditorial({content,reason:'[SYNTHETIC] Explicit local Guide Draft fixture; Human Publish required'},'synthetic-preview-editor');
  }
}
