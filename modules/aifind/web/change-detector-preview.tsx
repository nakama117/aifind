import {useLoaderData,useRevalidator} from 'react-router';
import {adminGet} from '@aihot/web/lib/admin.server';
import {useAdminAction} from '@aihot/web/features/admin/action';
import {AdminPage,Card,Button,ButtonLink,Badge} from '../../../apps/web/app/features/admin/ui.tsx';
import type {DetectorPreview} from '../preview/detector-service.ts';
import {AdminNav,adminMeta,adminHeaders,ValueRows} from './admin-common.tsx';
import {Snapshot,At,Price} from './product-view.tsx';
import type {ProductPrice} from '../contracts.ts';
export const meta=()=>adminMeta('Phase 4 Product Resolver + Change Detector');
export const headers=adminHeaders;
export const loader=({request}:{request:Request})=>adminGet<DetectorPreview|null>(request,'/api/admin/aifind/preview/change-detector');
export default function ChangeDetectorPreviewPage(){
  const d=useLoaderData<typeof loader>(),r=useRevalidator(),{run,busy}=useAdminAction();
  if(!d)return <AdminPage title="Phase 4 Preview"><p>専用の local/dev/test データベースに seed を作成してください。</p></AdminPage>;
  const candidate=d.candidates.find(c=>c.candidate.productId===d.main.identity.id);
  const staleObservation=d.staleWait?d.observations.find(o=>o.id===d.staleWait!.observationId):null;
  return <AdminPage title="Phase 4 · Resolver + Change Detector" subtitle="合成デモ · 実際の PostgreSQL / Queue / Domain Reader を使う管理者専用 Preview" actions={<Button onClick={()=>r.revalidate()}>最新の結果を読み込む</Button>}>
    <div lang="ja" className="space-y-5"><AdminNav />
      <Card title="Source → Observation → Candidate → Human Review"><p className="text-sm">外部取得・有料モデルは閉じたままです。ボタンは合成ソースを worker に排隊し、検出結果をレビュー待ちにします。承認・Draft 適用・公開は別の人手操作です。</p>
        <div className="mt-4 flex flex-wrap gap-2">{d.fixtures.map(f=><Button key={f.key} disabled={busy||!d.canRun} onClick={async()=>{await run('POST','/api/admin/aifind/preview/change-detector/run',{fixtureKey:f.key,reason:'[PREVIEW] Administrator requested synthetic '+f.key},{success:'Worker に排隊しました。完了後に結果を再読み込みしてください。'});}}>
          {f.key==='main'?'価格変更 / 同じソースを再実行':f.key==='ambiguous'?'Copilot の曖昧ケースを実行':f.key==='stale_commit'?'検出を待機（P06）':'基準版ケースを実行'}</Button>)}<Button disabled={busy||!d.canRun||!candidate} onClick={async()=>{await run('POST','/api/admin/aifind/preview/change-detector/run',{fixtureKey:'repeat_main',reason:'[PREVIEW] Administrator repeated the same synthetic Observation'},{success:'同じ Observation を worker に排隊しました。'});}}>同じ Observation を再実行（P05）</Button></div>
        <p className="mt-3 text-xs text-ink-3">同じ内容は unchanged となり、新たな Candidate・モデル呼び出し・確認日時更新を行いません。</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2"><Card title="P01 · 唯一の製品同定"><p className="text-sm">{d.main.identity.canonicalName}</p><p className="mt-2 text-xs text-ink-3">登録済み Source と製品 identity を照合します。</p>
        {d.observations.filter(o=>o.productId===d.main.identity.id&&o.resolution?.status==='resolved').slice(0,1).map(o=><p key={o.id} data-resolver-resolved className="mt-3 text-sm">{o.resolution!.status} · {o.resolution!.method} · {o.resolution!.productId}</p>)}</Card>
        <Card title="P02 · 曖昧な Copilot"><p className="text-sm">同じ alias を持つ Microsoft / GitHub の合成製品。曖昧な資料は提案を作りません。</p>
          {d.observations.filter(o=>o.identityHint==='Copilot').slice(0,1).map(o=><div key={o.id} data-resolver-ambiguous className="mt-3 text-sm">{o.resolution?.status??o.state} · {o.resolution?.candidateIds.length??0} 件の候補</div>)}</Card></div>
      <Card title="P03 / P05 · Observation と重複防止"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Source / State</th><th className="p-2">retrievedAt (JST)</th><th className="p-2">Content hash</th><th className="p-2">Candidate</th></tr></thead>
        <tbody>{d.observations.map(o=><tr key={o.id} data-observation-state={o.state} className="border-t border-line"><td className="p-2"><p>{o.identityHint??'未同定'}</p><Badge tone={o.state==='detected'?'ok':o.state==='ambiguous'||o.state==='stale'?'warn':'muted'}>{o.state}</Badge></td><td className="p-2"><At at={o.retrievedAt}/></td><td className="max-w-48 break-all p-2 text-ink-3">{o.contentHash??'取得失敗'}</td><td className="p-2">{o.candidateIds.length}</td></tr>)}</tbody></table></div>
        {!d.observations.length&&<p className="mt-3 text-sm text-ink-3">まだ観測していません。上のボタンから実行できます。</p>}
      </Card>
      {candidate&&<Card title="P04 / P07 · 実際の Detector Candidate"><div className="grid gap-4 md:grid-cols-2"><div data-detector-current><h3 className="mb-2 text-sm font-semibold text-ok">Current · 公開中</h3><ValueRows value={candidate.currentValue}/></div>
        <div data-detector-proposed><h3 className="mb-2 text-sm font-semibold text-amber">Proposed · 要確認</h3><Price price={candidate.candidate.proposedValue as unknown as ProductPrice}/><div className="mt-3"><ValueRows value={candidate.candidate.proposedValue}/></div></div></div>
        <div className="mt-4 border-t border-line pt-4"><p className="text-xs text-ink-3">Evidence: {candidate.evidence.sourceKind} · {candidate.evidence.publisher}<br/><a href={candidate.evidence.url} rel="noopener noreferrer" target="_blank" className="break-all text-accent underline">{candidate.evidence.url}</a></p>
          <p className="mt-2 text-xs">取得日時: <At at={candidate.evidence.retrievedAt}/> · 人による確認: <At at={candidate.candidate.reviewedAt}/></p>
          <pre data-detector-quote className="mt-3 whitespace-pre-wrap break-all rounded-control bg-bg-sunk p-3 text-xs">{candidate.detectorEvidence?.quote}</pre></div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Badge tone="warn">{candidate.candidate.status}</Badge><ButtonLink to={'/admin/aifind/review/'+candidate.candidate.id}>実際の Review Queue で確認</ButtonLink></div>
      </Card>}
      <Card title="P06 · Stale base 保護"><p className="text-sm">古い Published を基準にした検出は stale、古い Candidate の Apply は 409 で拒否します。</p>
        {d.staleWait&&<div className="mt-3 rounded-control bg-bg-sunk p-3 text-sm"><p data-stale-observation>{staleObservation?.state??'待機準備'} · Candidate {staleObservation?.candidateIds.length??0}</p><p className="mt-2 break-all text-xs">Base: {d.staleWait.baseVersionId} · 待機期限: <At at={d.staleWait.deadlineAt}/></p>
          {staleObservation?.state==='observed'&&<p className="mt-2">検出を待機しています。別の管理画面で基準版製品の Draft を作成し、手動で公開してください。worker は自動公開しません。</p>}<div className="mt-3"><ButtonLink to={'/admin/aifind/products/'+d.stale.identity.id}>基準版製品を手動で確認</ButtonLink></div></div>}
        {d.candidates.filter(c=>c.candidate.productId===d.stale.identity.id).map(c=><div key={c.candidate.id} className="mt-3"><p data-stale-conflict className="mb-2 text-sm text-hot">{c.conflict??'現在は基準版が一致しています。別の人手 Publish 後に競合を確認できます。'}</p><ButtonLink to={'/admin/aifind/review/'+c.candidate.id}>基準版ケースの Review</ButtonLink></div>)}
      </Card>
      <Card title="P08 / P09 · Applied Candidate ≠ Published"><p className="text-sm">Apply は Draft だけを変更します。公開サイトは別の人手 Publish まで V1 のままです。</p><div className="mt-4 flex flex-wrap gap-2"><ButtonLink to={'/admin/aifind/products/'+d.main.identity.id}>製品 Admin / Draft</ButtonLink><ButtonLink to={'/products/'+d.main.identity.slug}>現在の Public Product</ButtonLink></div></Card>
      <div className="grid items-start gap-5 xl:grid-cols-2"><Snapshot product={d.main.published} kind="published"/><Snapshot product={d.main.draft} kind="draft"/></div>
      <Card title="Source Monitor 状態"><div className="space-y-3">{d.monitors.map(m=><div key={m.id} className="text-xs text-ink-3"><p className="break-all">{m.url} · {m.enabled?'enabled':'disabled (synthetic only)'}</p><p>Last check: <At at={m.lastCheckAt}/> · Last changed: <At at={m.lastChangedAt}/> · Error: {m.lastError??'なし'}</p></div>)}</div></Card>
    </div>
  </AdminPage>;
}
