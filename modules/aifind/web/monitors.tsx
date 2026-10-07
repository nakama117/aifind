import {useState} from 'react';
import {useLoaderData,useRevalidator} from 'react-router';
import {adminGet} from '@aihot/web/lib/admin.server';
import {useAdminAction} from '@aihot/web/features/admin/action';
import {AdminPage,Card,Button,Input,Field,Select,ReasonDialog,ButtonLink} from '../../../apps/web/app/features/admin/ui.tsx';
import type {Monitor} from '../detector/contracts.ts';
import {SOURCE_KINDS} from '../contracts.ts';
import {AdminNav,adminMeta,adminHeaders,dialogCopy} from './admin-common.tsx';
import {At} from './product-view.tsx';
type PolicyEdit={status:Monitor['sourcePolicy']['status'];retentionClass:Monitor['sourcePolicy']['retentionClass'];excerptDays:number;allowAutomatedFetch:boolean;allowJina:boolean};
function PolicyForm({monitor,onReview,busy}:{monitor:Monitor;onReview:(p:PolicyEdit)=>void;busy:boolean}){
  const [p,setPolicy]=useState<PolicyEdit>({status:monitor.sourcePolicy.status,retentionClass:monitor.sourcePolicy.retentionClass,excerptDays:monitor.sourcePolicy.excerptDays,allowAutomatedFetch:monitor.sourcePolicy.allowAutomatedFetch,allowJina:monitor.sourcePolicy.allowJina});
  return <details className="my-4 rounded-control border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">Source policy を確認・記録</summary>
    <p className="my-3 text-xs text-ink-3">運用者による確認記録です。法的な許可を自動判定しません。未確認・blocked のソースは有効にできません。</p>
    <div className="grid gap-3 md:grid-cols-2"><Field label="Review status"><Select aria-label="Policy review status" value={p.status} onChange={e=>setPolicy({...p,status:e.target.value as PolicyEdit['status'],...(e.target.value!=='approved'?{allowAutomatedFetch:false,allowJina:false}:{})})}>{['unreviewed','approved','blocked'].map(v=><option key={v}>{v}</option>)}</Select></Field>
      <Field label="Retention class"><Select aria-label="Retention class" value={p.retentionClass} onChange={e=>setPolicy({...p,retentionClass:e.target.value as PolicyEdit['retentionClass']})}><option>evidence_only</option><option>short_excerpt</option></Select></Field>
      <Field label="Excerpt deadline（日・工学上の設定）"><Input type="number" min={1} max={365} aria-label="Excerpt days" value={p.excerptDays} onChange={e=>setPolicy({...p,excerptDays:Number(e.target.value)})}/></Field>
      <div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" aria-label="Allow automated fetch" disabled={p.status!=='approved'} checked={p.allowAutomatedFetch} onChange={e=>setPolicy({...p,allowAutomatedFetch:e.target.checked})}/>automated fetch を許可</label>
        <label className="flex items-center gap-2"><input type="checkbox" aria-label="Allow Jina policy" disabled={p.status!=='approved'} checked={p.allowJina} onChange={e=>setPolicy({...p,allowJina:e.target.checked})}/>Jina を別途許可（有料・transport 設定は独立）</label></div></div>
    <p className="my-3 text-xs text-ink-3">evidence_only は処理完了後に本文を削減し、引用・文脈・hash を保持します。short_excerpt は設定日数まで保持します。未完了の処理は削減せず preflight に表示します。</p>
    <Button disabled={busy||!Number.isInteger(p.excerptDays)||p.excerptDays<1||p.excerptDays>365} onClick={()=>onReview(p)}>Policy review を記録</Button>
  </details>;
}
export const meta=()=>adminMeta('Source Monitor');export const headers=adminHeaders;
export const loader=({request}:{request:Request})=>adminGet<Monitor[]>(request,'/api/admin/aifind/monitors');
export default function MonitorsPage(){const rows=useLoaderData<typeof loader>(),r=useRevalidator(),{run,busy}=useAdminAction();
  const [url,setUrl]=useState(''),[publisher,setPublisher]=useState(''),[productId,setProductId]=useState(''),[identityHint,setIdentity]=useState(''),[sourceKind,setKind]=useState<string>('official_product');
  const [action,setAction]=useState<{kind:'create'|'toggle'|'run'|'policy';monitor?:Monitor;policy?:PolicyEdit}|null>(null);
  return <AdminPage title="Source Monitor" subtitle="登録された公開ソースだけを worker が観測します。自動検出はレビュー待ちの提案だけを作成します。" actions={<Button onClick={()=>r.revalidate()}>再読み込み</Button>}><div className="space-y-5"><AdminNav/>
    <Card title="Source を登録"><div className="grid gap-3 md:grid-cols-2"><Field label="Source URL"><Input aria-label="Source URL" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></Field><Field label="Publisher"><Input aria-label="Publisher" value={publisher} onChange={e=>setPublisher(e.target.value)}/></Field>
      <Field label="Product ID（任意）"><Input aria-label="Product ID" value={productId} onChange={e=>setProductId(e.target.value)}/></Field><Field label="Product identity hint（任意）"><Input aria-label="Product identity hint" value={identityHint} onChange={e=>setIdentity(e.target.value)}/></Field>
      <Field label="Source kind"><Select aria-label="Source kind" value={sourceKind} onChange={e=>setKind(e.target.value)}>{SOURCE_KINDS.map(k=><option key={k}>{k}</option>)}</Select></Field></div>
      <p className="my-3 text-xs text-ink-3">初期状態は disabled、間隔は1日。Jina は初期状態で無効。URL の DNS と robots/access policy は worker が検査します。</p><Button disabled={busy||!url||!publisher} onClick={()=>setAction({kind:'create'})}>登録</Button></Card>
    {rows.map(m=><Card key={m.id} title={m.identityHint??m.publisher} right={<span className="text-xs text-ink-3">{m.enabled?'enabled':'disabled'} · revision {m.revision}</span>}>
      <a href={m.url} rel="noopener noreferrer" target="_blank" className="break-all text-sm text-accent underline">{m.url}</a><p className="mt-2 text-xs text-ink-3">{m.sourceKind} · {m.publisher} · {m.cadenceMinutes} 分</p>
      <div data-source-policy className="mt-3 text-xs"><p>Policy: <strong>{m.sourcePolicy.status}</strong> · retention: {m.sourcePolicy.retentionClass} · {m.sourcePolicy.excerptDays} 日</p><p>Reviewed: <At at={m.sourcePolicy.reviewedAt}/> · {m.sourcePolicy.reviewedBy??'未確認'} · {m.sourcePolicy.reason??'理由なし'}</p><p>automated fetch: {m.sourcePolicy.allowAutomatedFetch?'allowed':'not allowed'} · Jina policy: {m.sourcePolicy.allowJina?'allowed':'not allowed'}</p></div>
      <PolicyForm key={m.revision} monitor={m} busy={busy} onReview={policy=>setAction({kind:'policy',monitor:m,policy})}/>
      <div className="my-3 grid gap-2 text-xs md:grid-cols-2"><p>Last check: <At at={m.lastCheckAt}/></p><p>Last success: <At at={m.lastSuccessAt}/></p><p>Last changed: <At at={m.lastChangedAt}/></p><p>Next check: <At at={m.nextCheckAt}/></p></div><p className="mb-3 break-all text-xs text-ink-3">Hash: {m.lastContentHash??'未取得'} · Error: {m.lastError??'なし'}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy||(!m.enabled&&(m.sourcePolicy.status!=='approved'||!m.sourcePolicy.allowAutomatedFetch))} onClick={()=>setAction({kind:'toggle',monitor:m})}>{m.enabled?'無効にする':'有効にする'}</Button><Button disabled={busy||!m.enabled} onClick={()=>setAction({kind:'run',monitor:m})}>Run Now（排隊のみ）</Button>{m.productId&&<ButtonLink to={'/admin/aifind/products/'+m.productId}>製品</ButtonLink>}<ButtonLink to="/admin/aifind/review">Review Queue</ButtonLink></div>
    </Card>)}
    <ReasonDialog open={action!==null} title={action?.kind==='create'?'Source を登録':action?.kind==='run'?'観測を排隊':'Source 状態を変更'} description="操作を監査記録に保存します。外部観測には COLLECT_ENABLED と AIFIND_DETECTOR_ENABLED の両方が必要です。" copy={dialogCopy} confirmLabel="確定" busy={busy} onClose={()=>setAction(null)} onSubmit={async reason=>{
      const result=action?.kind==='policy'?await run('POST','/api/admin/aifind/monitors/'+action.monitor!.id+'/policy',{...action.policy,expectedRevision:action.monitor!.revision,reason}):action?.kind==='create'?await run('POST','/api/admin/aifind/monitors',{url,publisher,productId:productId||null,identityHint:identityHint||null,sourceKind,reason}):action?.kind==='toggle'?await run('PATCH','/api/admin/aifind/monitors/'+action.monitor!.id,{enabled:!action.monitor!.enabled,expectedRevision:action.monitor!.revision,reason}):await run('POST','/api/admin/aifind/monitors/'+action!.monitor!.id+'/run',{reason});
      return result!==null;
    }}/>
  </div></AdminPage>;
}
