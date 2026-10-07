import { useState } from 'react';
import { useAdminAction } from '@aihot/web/features/admin/action';
import { Button, Field, Input, Select, Textarea } from '../../../apps/web/app/features/admin/ui.tsx';
import type { EditorialContent, EditorialProductChoice } from '../editorial/contracts.ts';
import { ReasonField, Block } from './admin-common.tsx';
import {changeEditorialReference} from './editorial-selection.ts';
import { GuideEditor, emptyGuide } from './guide-editor.tsx';

export function emptyEditorial(type:'comparison'|'category'|'guide',title:string,slug:string):EditorialContent {
  if(type==='guide')return emptyGuide(title,slug);
  const common={title,slug,excerpt:'',bodyMd:'',seoTitle:'',seoDescription:''};
  return type==='comparison'?{...common,type,comparison:{mode:'official_sources',question:'',purpose:'',methodologyMd:'',verdictMd:'',goodForMd:'',notForMd:'',incomparableConditionsMd:'',limitationsMd:'',products:[]}}
    :{...common,type,category:{question:'',selectionCriteriaMd:'',limitationsMd:'',products:[]}};
}
export function EditorialEditor({content,choices,revision,id}:{content:EditorialContent;choices:EditorialProductChoice[];revision:number;id:string}){
  return content.type==='guide'?<GuideEditor content={content} choices={choices} revision={revision} id={id}/>:<ExistingEditor content={content} choices={choices} revision={revision} id={id}/>;
}
function ExistingEditor({content,choices,revision,id}:{content:Exclude<EditorialContent,{type:'guide'}>;choices:EditorialProductChoice[];revision:number;id:string}){
  const [c,set]=useState(content),[reason,setReason]=useState(''),{run,busy}=useAdminAction();
  const path='/api/admin/aifind/'+(c.type==='comparison'?'compare':'categories')+'/'+id;
  const rows=c.type==='comparison'?c.comparison.products:c.category.products;
  const changeRows=(update:(v:Array<typeof rows[number]>)=>Array<typeof rows[number]>)=>set(v=>v.type==='comparison'?{...v,comparison:{...v.comparison,products:update(v.comparison.products) as typeof v.comparison.products}}:{...v,category:{...v.category,products:update(v.category.products) as typeof v.category.products}});
  const text=(label:string,value:string,change:(value:string)=>void,multiline=false,max=10000)=><Field key={label} label={label}>{multiline?<Textarea aria-label={label} value={value} maxLength={max} onChange={e=>change(e.target.value)}/>:<Input aria-label={label} value={value} maxLength={max} onChange={e=>change(e.target.value)}/>}</Field>;
  return <form data-editorial-editor className="space-y-4" onSubmit={async e=>{e.preventDefault();await run('PATCH',path+'/draft',{content:c,expectedRevision:revision,reason},{success:'Draft を保存しました。公開版は変更されません。'});}}>
    <div className="grid gap-3 sm:grid-cols-2">{(['title','slug','excerpt','seoTitle','seoDescription','bodyMd'] as const).map(key=>text(({title:'タイトル',slug:'Slug',excerpt:'概要',seoTitle:'SEO タイトル',seoDescription:'SEO 説明',bodyMd:c.type==='category'?'導入文 Markdown':'本文 Markdown'})[key],c[key],value=>set(v=>({...v,[key]:value})),['bodyMd','excerpt'].includes(key),key==='bodyMd'?40000:key==='slug'?100:key==='excerpt'?2000:key==='seoDescription'?500:200))}</div>
    {c.type==='comparison'?<Block title="比較の編集判断（製品の事実は Reader から取得）"><Field label="比較方法"><Select aria-label="比較方法" value={c.comparison.mode} onChange={e=>set({...c,comparison:{...c.comparison,mode:e.target.value as 'official_sources'|'hands_on'}})}><option value="official_sources">公式情報の整理 · 実測していません</option><option value="hands_on">実測 · 各製品の Test Record が必須</option></Select></Field>
      {(['question','purpose','methodologyMd','verdictMd','goodForMd','notForMd','incomparableConditionsMd','limitationsMd'] as const).map(key=>text(({question:'比較する問い',purpose:'比較の目的',methodologyMd:'比較方法 Markdown',verdictMd:'編集の結論 Markdown',goodForMd:'向いている人 Markdown',notForMd:'向かない人 Markdown',incomparableConditionsMd:'単純比較できない条件 Markdown',limitationsMd:'限界 Markdown'})[key],c.comparison[key],value=>set({...c,comparison:{...c.comparison,[key]:value}}),key.endsWith('Md')))}</Block>
      :<Block title="用途と選定基準">{text('用途の問い',c.category.question,value=>set({...c,category:{...c.category,question:value}}))}{text('選定基準 Markdown',c.category.selectionCriteriaMd,value=>set({...c,category:{...c.category,selectionCriteriaMd:value}}),true)}{text('限界 Markdown',c.category.limitationsMd,value=>set({...c,category:{...c.category,limitationsMd:value}}),true)}</Block>}
    <Block title={`Products · 公開時は ${c.type==='comparison'?'2–3':'3–5'} 件`}><p className="text-xs text-ink-3">表示順は順位ではありません。参照版は Published 履歴から選びます。公開時は現在 listed / public-ready の製品が必要です。</p>
      {rows.map((p,i)=>{const choice=choices.find(v=>v.productId===p.productId),update=(patch:object)=>changeRows(v=>v.map((row,n)=>n===i?{...row,...patch}:row));return <fieldset data-editorial-product key={p.productId} className="space-y-3 rounded-control border border-line p-3"><legend className="text-xs">製品 {i+1}</legend>
        <Field label={`製品 ${i+1}`}><Select aria-label={`製品 ${i+1}`} value={p.productId} onChange={e=>{const next=choices.find(v=>v.productId===e.target.value)!;update(changeEditorialReference(p,next.productId,next.versions[0].id));}}>{choices.filter(v=>v.productId===p.productId||!rows.some(r=>r.productId===v.productId)).map(v=><option key={v.productId} value={v.productId}>{v.name} · {v.visibility}</option>)}</Select></Field>
        <Field label={`参照版 ${i+1}`}><Select aria-label={`参照版 ${i+1}`} value={p.referencePublishedVersionId} onChange={e=>update(changeEditorialReference(p,p.productId,e.target.value))}>{choice?.versions.map(v=><option key={v.id} value={v.id}>v{v.versionNo} · {v.publishedAt}</option>)}</Select></Field>
        {'fitSummaryJa' in p?<>{text(`適する条件 ${i+1}`,p.fitSummaryJa,value=>update({fitSummaryJa:value}),true,2000)}{text(`適さない条件 ${i+1}`,p.notForSummaryJa,value=>update({notForSummaryJa:value}),true,2000)}{text(`選定理由 ${i+1}`,p.selectionNote,value=>update({selectionNote:value}),true,2000)}</>:<>
          <p role="note" className="text-xs text-ink-3">製品または参照版を変更すると、Test Record とテストした Plan / Price の参照を消去します。新しい対象で実測し、記録を入力し直してください。</p>
          {text(`テストした Plan key ${i+1}`,p.testedPlanKey??'',value=>update({testedPlanKey:value||null}))}{text(`テストした Price reference ${i+1}`,p.testedPriceRef??'',value=>update({testedPriceRef:value||null}))}
          <p className="text-xs text-ink-3">任意の識別子です。指定した場合は参照版への所属を DB が検証します。現在の価格はコピーしません。</p>
          <label className="text-sm"><input type="checkbox" aria-label={`Test Record ${i+1}`} checked={!!p.testRecord} onChange={e=>update({testRecord:e.target.checked?{task:'',environmentMd:'',procedureMd:'',resultMd:'',limitationsMd:'',testedAt:'',reviewer:'',repeatCount:null,errorCriteria:null}:null})}/> Test Record を記録する</label>
          {p.testRecord&&<div data-test-record-editor className="space-y-3">{(['task','environmentMd','procedureMd','resultMd','limitationsMd','testedAt','reviewer','errorCriteria'] as const).map(key=>text(`${({task:'タスク',environmentMd:'環境 Markdown',procedureMd:'手順 Markdown',resultMd:'結果 Markdown',limitationsMd:'テストの限界 Markdown',testedAt:'testedAt（タイムゾーン必須）',reviewer:'実測担当者',errorCriteria:'エラー判定基準'})[key]} ${i+1}`,p.testRecord![key]??'',value=>update({testRecord:{...p.testRecord,[key]:key==='errorCriteria'?value||null:value}}),key.endsWith('Md')))}
            <Field label={`反復回数 ${i+1}`}><Input aria-label={`反復回数 ${i+1}`} type="number" min={1} max={10000} value={p.testRecord.repeatCount??''} onChange={e=>update({testRecord:{...p.testRecord,repeatCount:e.target.value?Number(e.target.value):null}})}/></Field></div>}
        </>}
        <div className="flex gap-2"><Button size="sm" disabled={i===0} onClick={()=>changeRows(v=>{const copy=[...v];[copy[i-1],copy[i]]=[copy[i],copy[i-1]];return copy.map((r,n)=>({...r,position:n+1}));})}>上へ</Button><Button size="sm" onClick={()=>changeRows(v=>v.filter((_,n)=>n!==i).map((r,n)=>({...r,position:n+1})))}>製品を外す</Button></div>
      </fieldset>;})}
      <Button disabled={rows.length>=10||!choices.some(v=>!rows.some(r=>r.productId===v.productId))} onClick={()=>{const next=choices.find(v=>!rows.some(r=>r.productId===v.productId));if(!next)return;const ref={productId:next.productId,position:rows.length+1,referencePublishedVersionId:next.versions[0].id};if(c.type==='comparison')set({...c,comparison:{...c.comparison,products:[...c.comparison.products,{...ref,testedPlanKey:null,testedPriceRef:null,testRecord:null}]}});else set({...c,category:{...c.category,products:[...c.category.products,{...ref,fitSummaryJa:'',notForSummaryJa:'',selectionNote:''}]}});}}>製品を追加</Button>
    </Block><ReasonField value={reason} onChange={setReason}/><Button type="submit" busy={busy} disabled={!reason.trim()}>Draft を保存</Button>
  </form>;
}
