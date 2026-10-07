import { sql } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { assertPreviewWrites } from './config.ts';
import { seedDiscoveryPreview } from './discovery-seed.ts';
import { readAdminProduct } from '../admin/read.ts';
import { createEditorial } from '../editorial/documents.ts';
import type { EditorialContent,TestRecord } from '../editorial/contracts.ts';

export const EDITORIAL_PREVIEW_SLUGS=['aifind-preview-editorial-compare','aifind-preview-editorial-hands-on','aifind-preview-editorial-category'] as const;
/** Explicit local setup only. These editorial documents remain Draft until separate human Publish. */
export async function seedEditorialPreview():Promise<void>{
  assertPreviewWrites({...process.env,DATABASE_URL:config.databaseUrl});
  const existing=await sql`SELECT DISTINCT d.id FROM af_editorial_documents d JOIN af_editorial_revisions r ON r.document_id=d.id WHERE r.slug IN ${sql([...EDITORIAL_PREVIEW_SLUGS])}`;
  if(existing.length){if(existing.length!==3)throw Error('Partial editorial seed: preserve existing work and use a fresh disposable database');return;}
  await seedDiscoveryPreview();
  const all=await sql`SELECT id,slug FROM af_products WHERE slug IN ${sql(['01','02','03','04','05','06'].map(n=>'aifind-preview-discovery-'+n))}`;
  const products=await Promise.all(all.map(p=>readAdminProduct(p.id))),bySlug=new Map(products.map(p=>[p.identity.slug,p]));
  const refs=(numbers:string[])=>numbers.map((n,i)=>{const p=bySlug.get('aifind-preview-discovery-'+n)!;if(!p?.published)throw Error('Missing Published synthetic Product');return{productId:p.identity.id,position:i+1,referencePublishedVersionId:p.published.version.id};});
  const common={title:'[PREVIEW] [SYNTHETIC] 日本語の資料整理を、条件から比べる',excerpt:'合成デモの編集判断です。実在する製品の評価・料金・実測ではありません。',bodyMd:'## 共通の条件\n少量の自作資料を扱う想定です。掲載した情報は合成データで、実在する製品には適用できません。',seoTitle:'',seoDescription:''};
  const comparison={mode:'official_sources' as const,question:'[SYNTHETIC] 資料整理に合う条件は？',purpose:'[SYNTHETIC] 入力・出力・利用地域と料金条件を揃えて検討する。',methodologyMd:'公式資料を整理する形式の合成デモです。実在する製品の公式資料は取得しておらず、実測していません。',verdictMd:'[SYNTHETIC] 少量の公開資料を扱うなら、必要な機能と条件を先に確認してください。自動で優劣を付けません。',goodForMd:'自作の短い公開資料で条件を試せる人。',notForMd:'機密資料を未確認の条件で処理したい人。',incomparableConditionsMd:'利用プラン、入力長、地域、時点が異なる場合は単純比較できません。',limitationsMd:'単一の合成シナリオです。性能の測定・一般化・実在製品の推奨ではありません。'};
  const official:EditorialContent={...common,type:'comparison',slug:EDITORIAL_PREVIEW_SLUGS[0],comparison:{...comparison,products:refs(['01','03','04']).map(r=>({...r,testedPlanKey:'demo',testedPriceRef:null,testRecord:null}))}};
  const record:TestRecord={task:'[PREVIEW] [SYNTHETIC] 自作の短い資料の整理',environmentMd:'[SYNTHETIC] ローカルの表示テスト。実在する製品は実行していません。',procedureMd:'合成入力と合成結果を記録し、Test Record の表示を確認する。',resultMd:'[SYNTHETIC] テスト表示用の結果。実際の性能値ではありません。',limitationsMd:'合成デモなので実在の製品へ適用できません。',testedAt:'2026-10-06T01:00:00+09:00',reviewer:'[SYNTHETIC] Preview 担当者',repeatCount:1,errorCriteria:'[SYNTHETIC] 入力にない内容の追加を確認する形式。'};
  const hands:EditorialContent={...common,type:'comparison',slug:EDITORIAL_PREVIEW_SLUGS[1],title:'[PREVIEW] [SYNTHETIC] 実測記録の表示デモ',comparison:{...comparison,mode:'hands_on',methodologyMd:'[SYNTHETIC] Test Record の表示デモです。実際の製品を測定していません。',products:refs(['02','03']).map(r=>({...r,testedPlanKey:'demo',testedPriceRef:null,testRecord:record}))}};
  const category:EditorialContent={...common,type:'category',slug:EDITORIAL_PREVIEW_SLUGS[2],title:'[PREVIEW] [SYNTHETIC] 日本語の資料整理に向く条件を探す',category:{question:'[SYNTHETIC] 少量の資料整理を始めるには？',selectionCriteriaMd:'入力する資料の種類、利用地域、必要な日本語対応と予算の条件を明示して候補を選びます。掲載順は順位ではありません。',limitationsMd:'合成デモです。実在する製品の推奨や Best/Ranking ではありません。',products:refs(['01','03','04','05','06']).map((r,i)=>({...r,fitSummaryJa:'[SYNTHETIC] '+['短い文章の下書き','画像を含む資料の整理','料金条件を個別に相談','未確認事項を先に調査','利用地域を確認して検討'][i],notForSummaryJa:'機密資料や確認されていない利用条件では推奨しません。',selectionNote:'[SYNTHETIC] 用途と制約を明示する表示例です。自動の順位付けではありません。'}))}};
  for(const content of [official,hands,category])await createEditorial({content,reason:'[SYNTHETIC] Explicit local Editorial Draft setup; separate human Publish required'},'synthetic-preview-editor');
}
