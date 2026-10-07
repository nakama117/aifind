import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router';
import type { AdminMe } from '@aihot/contracts/admin';
import { useAdminAction } from '@aihot/web/features/admin/action';
import { Button, Field, Input, Select, Textarea } from '../../../apps/web/app/features/admin/ui.tsx';
import type { EditorialContent, EditorialProductChoice, GuideContent } from '../editorial/contracts.ts';
import type { EditorialAsset } from '../editorial/assets.ts';
import { ReasonField, Block } from './admin-common.tsx';
import { appendUploadedGuideAsset } from './guide-assets.ts';
type Guide=Extract<EditorialContent,{type:'guide'}>;
export function emptyGuide(title:string,slug:string):Guide{return{type:'guide',title,slug,excerpt:'',bodyMd:'',seoTitle:'',seoDescription:'',guide:{mode:'official_sources',task:'',taskResultMd:'',prerequisitesMd:'',materialsMd:'',stepsMd:'',resultMd:'',failuresMd:'',limitationsMd:'',costNotesMd:'',alternativesMd:'',products:[],assets:[]}};}
export function changeGuideReference(p:GuideContent['products'][number],productId:string,referencePublishedVersionId:string,referencedPlanKey:string|null=null){
  if(p.productId===productId&&p.referencePublishedVersionId===referencePublishedVersionId&&p.referencedPlanKey===referencedPlanKey)return p;
  return{...p,productId,referencePublishedVersionId,referencedPlanKey,referencedPriceRef:null,testRecord:null};
}
const labels={task:'解決するタスク',taskResultMd:'できること Markdown',prerequisitesMd:'必要なアカウント・Plan Markdown',materialsMd:'入力素材 Markdown',stepsMd:'手順 Markdown',resultMd:'結果 Markdown',failuresMd:'失敗例 Markdown',limitationsMd:'限界 Markdown',costNotesMd:'費用と条件 Markdown',alternativesMd:'代替手段 Markdown'} as const;
export function GuideEditor({content,choices,revision,id}:{content:Guide;choices:EditorialProductChoice[];revision:number;id:string}){
  const [c,set]=useState(content),[reason,setReason]=useState(''),{run,busy}=useAdminAction();
  const [assets,setAssets]=useState<EditorialAsset[]>([]),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<File|null>(null);
  const me=(useRouteLoaderData('admin-layout') as {me:AdminMe}|undefined)?.me;
  useEffect(()=>{let active=true;const ids=content.guide.assets.map(a=>a.assetId),paths=['/api/admin/aifind/assets',...(ids.length?['/api/admin/aifind/assets?ids='+encodeURIComponent(ids.join(','))]:[])];
    Promise.all(paths.map(p=>fetch(p,{credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('画像一覧を取得できません。');return r.json() as Promise<EditorialAsset[]>;})))
      .then(rows=>{if(active)setAssets(current=>[...new Map([...rows.flat(),...current].map(a=>[a.id,a])).values()]);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
  },[content.guide.assets]);
  const g=c.guide,change=(patch:Partial<GuideContent>)=>set(v=>({...v,guide:{...v.guide,...patch}}));
  const update=(i:number,patch:Partial<GuideContent['products'][number]>)=>change({products:g.products.map((p,n)=>n===i?{...p,...patch}:p)});
  const field=(label:string,value:string,onChange:(s:string)=>void,multiline=false,max=10000)=><Field key={label} label={label}>{multiline?<Textarea aria-label={label} value={value} maxLength={max} onChange={e=>onChange(e.target.value)}/>:<Input aria-label={label} value={value} maxLength={max} onChange={e=>onChange(e.target.value)}/>}</Field>;
  async function upload(){
    if(!file||!reason.trim())return;setUploading(true);setError('');
    try{const form=new FormData();form.set('image',file);form.set('reason',reason);
      const r=await fetch('/api/admin/aifind/assets',{method:'POST',credentials:'same-origin',headers:{'x-csrf-token':me?.csrf??''},body:form});
      const a=await r.json();if(!r.ok)throw Error(a.detail??'アップロードに失敗しました。');
      setAssets(v=>[a,...v]);set(v=>({...v,guide:{...v.guide,assets:appendUploadedGuideAsset(v.guide.assets,a.id)}}));setFile(null);
    }catch(e){setError((e as Error).message);}finally{setUploading(false);}
  }
  return <form data-guide-editor data-editorial-editor className="space-y-4" onSubmit={async e=>{e.preventDefault();await run('PATCH','/api/admin/aifind/howto/'+id+'/draft',{content:c,expectedRevision:revision,reason},{success:'Guide Draft を保存しました。公開版は変更されません。'});}}>
    <div className="grid gap-3 sm:grid-cols-2">{(['title','slug','excerpt','bodyMd','seoTitle','seoDescription']as const).map(k=>field(({title:'タイトル',slug:'Slug',excerpt:'概要',bodyMd:'資料と補足 Markdown',seoTitle:'SEO タイトル',seoDescription:'SEO 説明'})[k],c[k],value=>set(v=>({...v,[k]:value})),['excerpt','bodyMd'].includes(k),k==='bodyMd'?40000:k==='excerpt'?2000:k==='slug'?100:k==='seoDescription'?500:200))}</div>
    <Block title="Guide · 人が記録した手順"><Field label="Guide の根拠"><Select aria-label="Guide の根拠" value={g.mode} onChange={e=>change({mode:e.target.value as GuideContent['mode']})}><option value="official_sources">公式資料に基づく解説 · 実測ではありません</option><option value="hands_on">実測 · 主製品の Test Record が必須</option></Select></Field>
      {Object.entries(labels).map(([key,label])=>field(label,g[key as keyof typeof labels],value=>change({[key]:value}),key!=='task',key==='stepsMd'?20000:key==='task'?2000:key.endsWith('Md')&&['prerequisitesMd','limitationsMd','costNotesMd','alternativesMd'].includes(key)?5000:10000))}
    </Block>
    <Block title="Product 参照 · 1–3 件 / 主製品 1 件"><p className="text-xs leading-5 text-ink-3">事実や金額をここにコピーしません。現在の Published と、手順の参照版を Reader から別々に取得します。製品・参照版・Plan を変えると古い Test Record を消去します。</p>
      {g.products.map((p,i)=>{const choice=choices.find(v=>v.productId===p.productId),t=p.testRecord;return <fieldset data-guide-product key={p.productId} className="space-y-3 rounded-control border border-line p-3"><legend>製品 {i+1}</legend>
        <Field label={`製品 ${i+1}`}><Select aria-label={`製品 ${i+1}`} value={p.productId} onChange={e=>{const v=choices.find(v=>v.productId===e.target.value)!;update(i,changeGuideReference(p,v.productId,v.versions[0].id));}}>{choices.filter(v=>v.productId===p.productId||!g.products.some(p=>p.productId===v.productId)).map(v=><option key={v.productId} value={v.productId}>{v.name} · {v.visibility}</option>)}</Select></Field>
        <Field label={`役割 ${i+1}`}><Select aria-label={`役割 ${i+1}`} value={p.role} onChange={e=>update(i,{role:e.target.value as typeof p.role})}><option value="primary">主製品</option><option value="alternative">代替製品</option><option value="prerequisite">前提製品</option></Select></Field>
        <Field label={`参照版 ${i+1}`}><Select aria-label={`参照版 ${i+1}`} value={p.referencePublishedVersionId} onChange={e=>update(i,changeGuideReference(p,p.productId,e.target.value))}>{choice?.versions.map(v=><option key={v.id} value={v.id}>v{v.versionNo} · {v.publishedAt}</option>)}</Select></Field>
        {field(`参照 Plan key ${i+1}`,p.referencedPlanKey??'',value=>update(i,changeGuideReference(p,p.productId,p.referencePublishedVersionId,value||null)))}
        {field(`参照 Price ID ${i+1}`,p.referencedPriceRef??'',value=>update(i,{referencedPriceRef:value||null}))}
        <label className="text-sm"><input aria-label={`Guide Test Record ${i+1}`} type="checkbox" checked={!!t} onChange={e=>update(i,{testRecord:e.target.checked?{productId:p.productId,referencePublishedVersionId:p.referencePublishedVersionId,referencedPlanKey:p.referencedPlanKey,task:'',environmentMd:'',procedureMd:'',resultMd:'',limitationsMd:'',testedAt:'',reviewer:'',repeatCount:null,errorCriteria:null}:null})}/> Test Record を記録する</label>
        {t&&<div data-test-record-editor className="space-y-3"><p className="text-xs">この Guide revision / Product / 参照版 / Plan に結びついた記録です。日時を別のバージョンへ付け替えることはできません。</p>
          {(['task','environmentMd','procedureMd','resultMd','limitationsMd','testedAt','reviewer','errorCriteria']as const).map(k=>field(`実測 ${({task:'タスク',environmentMd:'環境 Markdown',procedureMd:'手順 Markdown',resultMd:'結果 Markdown',limitationsMd:'限界 Markdown',testedAt:'testedAt（タイムゾーン必須）',reviewer:'担当者',errorCriteria:'エラー判定基準'})[k]} ${i+1}`,t[k]??'',value=>update(i,{testRecord:{...t,[k]:k==='errorCriteria'?value||null:value}}),k.endsWith('Md')))}
          <Field label="反復回数"><Input aria-label="反復回数" type="number" min={1} max={10000} value={t.repeatCount??''} onChange={e=>update(i,{testRecord:{...t,repeatCount:e.target.value?Number(e.target.value):null}})}/></Field>
        </div>}
        <Button size="sm" onClick={()=>change({products:g.products.filter((_,n)=>n!==i).map((p,n)=>({...p,position:n+1}))})}>製品を外す</Button>
      </fieldset>;})}
      <Button disabled={g.products.length>=3||!choices.some(v=>!g.products.some(p=>p.productId===v.productId))} onClick={()=>{const v=choices.find(v=>!g.products.some(p=>p.productId===v.productId));if(v)change({products:[...g.products,{productId:v.productId,position:g.products.length+1,role:g.products.length?'alternative':'primary',referencePublishedVersionId:v.versions[0].id,referencedPlanKey:null,referencedPriceRef:null,testRecord:null}]});}}>製品を追加</Button>
    </Block>
    <Block title="画像 · 永続化された sanitized rendition"><p className="text-xs leading-5 text-ink-3">PNG / JPEG / 静止 WebP、5 MiB 以下。メタデータを除去して再エンコードします。原画像は保存せず SHA-256 のみ保持します。アップロードだけでは公開されません。関連付けは Draft の保存時に確定します。</p>
      {error&&<p role="alert" className="text-sm text-hot">{error}</p>}
      <Field label="画像ファイル"><Input aria-label="画像ファイル" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]??null)}/></Field>
      <Button disabled={!file||!reason.trim()||g.assets.length>=30} busy={uploading} onClick={upload}>画像をアップロード</Button>
      <p className="text-xs text-ink-3">アップロード・権利確認にも、下の操作理由を使用します。関連付けは最大30点です。アップロード中に上限へ達した画像は、保存済み画像から後で再利用できます。</p>
      {g.assets.map((r,i)=>{const a=assets.find(a=>a.id===r.assetId),setRef=(patch:Partial<typeof r>)=>change({assets:g.assets.map((v,n)=>n===i?{...v,...patch}:v)});return <div data-guide-asset key={r.assetId} className="min-w-0 space-y-3 rounded-control border border-line p-3">
        <img src={'/api/admin/aifind/assets/'+r.assetId+'/file'} alt={r.altJa||'Draft 画像プレビュー'} className="max-h-48 max-w-full rounded-control object-contain"/>
        <Field label={`画像の役割 ${i+1}`}><Select aria-label={`画像の役割 ${i+1}`} value={r.role} onChange={e=>setRef({role:e.target.value as typeof r.role})}><option value="cover">表紙</option><option value="step">手順</option><option value="result">結果</option><option value="reference">参考</option></Select></Field>
        {field(`画像キャプション ${i+1}`,r.captionJa,value=>setRef({captionJa:value}),false,2000)}{field(`画像 alt ${i+1}`,r.altJa,value=>setRef({altJa:value}),false,500)}
        {a&&<AssetReview asset={a} reason={reason} onReviewed={next=>setAssets(v=>v.map(a=>a.id===next.id?next:a))}/>}
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={i===0} onClick={()=>{const next=[...g.assets];[next[i-1],next[i]]=[next[i],next[i-1]];change({assets:next.map((r,n)=>({...r,position:n+1}))});}}>画像を上へ</Button><Button size="sm" onClick={()=>change({assets:g.assets.filter((_,n)=>n!==i).map((r,n)=>({...r,position:n+1}))})}>画像を外す</Button></div>
      </div>;})}
      <Field label="保存済み画像を再利用"><Select aria-label="保存済み画像を再利用" value="" onChange={e=>{if(e.target.value)change({assets:[...g.assets,{assetId:e.target.value,role:'reference',position:g.assets.length+1,captionJa:'',altJa:''}]});}} disabled={g.assets.length>=30}><option value="">画像を選択</option>{assets.filter(a=>!g.assets.some(r=>r.assetId===a.id)).map(a=><option key={a.id} value={a.id}>{a.id} · {a.width}×{a.height} · {a.rightsBasis}</option>)}</Select></Field>
    </Block>
    <ReasonField value={reason} onChange={setReason}/><Button type="submit" busy={busy} disabled={!reason.trim()||uploading}>Draft を保存</Button>
  </form>;
}
function AssetReview({asset:a,reason,onReviewed}:{asset:EditorialAsset;reason:string;onReviewed:(a:EditorialAsset)=>void}){
  const [basis,setBasis]=useState(a.rightsBasis),[note,setNote]=useState(a.rightsNote),[source,setSource]=useState(a.sourceUrl??''),[rights,setRights]=useState(false),[privacy,setPrivacy]=useState(false),{run,busy}=useAdminAction();
  return <fieldset data-asset-review className="space-y-3"><legend className="text-sm font-medium">Rights / Privacy review</legend>
    <p className="break-all text-xs text-ink-3">Asset {a.id} · {a.width}×{a.height} · {a.byteSize} bytes<br/>rights：{a.rightsReviewedAt??'未確認'} / privacy：{a.privacyReviewedAt??'未確認'}</p>
    <Field label="Rights basis"><Select aria-label={'Rights basis '+a.id} value={basis} onChange={e=>setBasis(e.target.value as typeof basis)}><option value="unreviewed">未審査</option><option value="self_captured">自分で撮影・作成</option><option value="owned">権利を保有</option><option value="licensed">利用許諾あり</option></Select></Field>
    <Field label="権利の確認メモ"><Textarea aria-label={'権利の確認メモ '+a.id} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></Field>
    <Field label="Source URL（任意）"><Input aria-label={'Source URL '+a.id} value={source} maxLength={2000} onChange={e=>setSource(e.target.value)}/></Field>
    <label className="block text-sm"><input type="checkbox" aria-label={'Rights reviewed '+a.id} checked={rights} onChange={e=>setRights(e.target.checked)}/> 公開する権利を確認した</label>
    <label className="block text-sm"><input type="checkbox" aria-label={'Privacy reviewed '+a.id} checked={privacy} onChange={e=>setPrivacy(e.target.checked)}/> 個人情報・機密・API key が写っていないことを確認した</label>
    <p className="text-xs text-ink-3">未チェックで保存すると該当の審査を撤回し、公開出口から画像と Guide を除外します。</p>
    <Button busy={busy} disabled={!reason.trim()} onClick={async()=>{const next=await run<EditorialAsset>('POST','/api/admin/aifind/assets/'+a.id+'/review',{rightsBasis:basis,rightsNote:note,sourceUrl:source||null,rightsReviewed:rights,privacyReviewed:privacy,reason},{success:'画像の審査を記録しました。',revalidate:false});if(next)onReviewed(next);}}>画像の審査を保存</Button>
  </fieldset>;
}
