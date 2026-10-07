import {useState} from 'react';
import {useLoaderData,Link} from 'react-router';
import {adminGet} from '@aihot/web/lib/admin.server';
import {useAdminAction} from '@aihot/web/features/admin/action';
import {AdminPage,Card,Button,ButtonLink,Badge} from '../../../apps/web/app/features/admin/ui.tsx';
import {adminMeta,adminHeaders,AdminNav} from './admin-common.tsx';
import {ProductCards} from './public-view.tsx';
import type {DiscoveryPreview} from '../preview/discovery-service.ts';
import type {PackInspection} from '../catalog-pack/import.ts';
export const meta=()=>adminMeta('Phase 5 Product Discovery + Catalog Bootstrap');
export const headers=adminHeaders;
export const loader=({request}:{request:Request})=>adminGet<DiscoveryPreview>(request,'/api/admin/aifind/preview/product-discovery');
export default function DiscoveryPreviewPage(){
  const d=useLoaderData<typeof loader>(),{run,busy}=useAdminAction(),[result,setResult]=useState<PackInspection|null>(null);
  const command=async(action:'dry-run'|'import',example:'valid'|'missing-evidence'|'bad-money'|'existing-conflict')=>{
    const r=await run<PackInspection>('POST','/api/admin/aifind/preview/product-discovery/pack',{action,example},{success:action==='import'?'Draft をインポートしました。公開操作は別です。':'検証結果を取得しました。'});if(r)setResult(r);
  };
  const inspected=result??d.inspection;
  return <AdminPage title="Phase 5 · Product Discovery + Catalog Bootstrap" subtitle="管理者専用 · 合成データ / PostgreSQL / Domain Reader / Site API / SSR">
    <div lang="ja" className="space-y-5"><AdminNav/>
      <Card title="LOCAL / TEST ONLY · SYNTHETIC"><p className="text-sm leading-6">すべての製品・提供元・料金・Evidence は合成の受入テストです。実在製品の事実ではありません。検索は公開中のデータベースを読み、Pack は Draft の輸送形式だけに使います。</p><p className="mt-2 text-xs text-ink-3">Published のデモは明示的な seed が別の人手 Publish / visibility を模擬した結果です。通常起動と Pack import は公開しません。</p><div className="mt-3 flex flex-wrap gap-2"><ButtonLink to="/products">実際の Public Directory</ButtonLink><ButtonLink to="/">実際の Homepage</ButtonLink></div></Card>
      <Card title="P01–P15 · Discovery ケース"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{d.cases.filter(c=>c.path).map(c=><Link key={c.id} data-preview-case={c.id} to={c.path!} className="rounded-control border border-line p-3 text-sm text-accent">{c.id} · {c.title}</Link>)}</div></Card>
      <Card title="P16–P23 · Catalog Pack → Draft → Human Publish"><p className="text-sm leading-6">dry-run は行数を変更しません。import は private の製品と Draft のみ作成します。同じ Pack は再利用、手編集済み Draft・既存 Published の基準版未指定・Evidence / 金額の不備は拒否します。</p>
        <div data-catalog-bootstrap className="mt-4 flex flex-wrap gap-2">
          <Button data-preview-action="dry-run" disabled={busy||!d.canImport} onClick={()=>command('dry-run','valid')}>P16 · dry-run</Button>
          <Button data-preview-action="import" disabled={busy||!d.canImport} onClick={()=>command('import','valid')}>P17 / P18 · Draft import / 再実行</Button>
          <Button disabled={busy||!d.canImport} onClick={()=>command('dry-run','existing-conflict')}>P19 · 既存 Product conflict</Button>
          <Button disabled={busy||!d.canImport} onClick={()=>command('dry-run','missing-evidence')}>P20 · Evidence エラー</Button>
          <Button disabled={busy||!d.canImport} onClick={()=>command('dry-run','bad-money')}>P21 · 金額エラー</Button>
        </div>
        {inspected&&<div data-pack-result className="mt-4 rounded-control bg-bg-sunk p-4"><Badge tone={inspected.valid?'ok':'warn'}>{inspected.valid?'VALID':'REJECTED'}</Badge><p className="mt-2 break-words text-xs">{inspected.packId??'invalid pack'} / revision {inspected.revision??'—'} · Evidence {inspected.evidenceCount} · disabled Monitors {inspected.monitorCount}</p>
          {inspected.products.map(p=><p key={p.slug} data-import-state={p.state} className="mt-2 break-words text-sm">{p.slug} · <strong>{p.state}</strong>{p.reason&&' · '+p.reason}</p>)}{inspected.errors.map(e=><p key={e} className="mt-2 break-words text-xs text-hot">{e}</p>)}</div>}
        {d.bootstrapProduct&&<div data-imported-draft className="mt-4 space-y-2 border-t border-line pt-4 text-sm"><p>Published: {d.bootstrapProduct.published?'あり':'なし'} · Draft: {d.bootstrapProduct.draft?.version.status??'なし'} · visibility: {d.bootstrapProduct.publicSettings.visibility}</p><p>公開には製品 Admin で根拠を確認し、別の Publish と visibility 設定が必要です。</p><ButtonLink to={'/admin/aifind/products/'+d.bootstrapProduct.identity.id}>P23 · 実際の Product Admin で確認</ButtonLink><p><Link to="/products?q=Import%20Only" className="text-accent underline">P22 · 未 Publish の製品は公開検索に出ない</Link></p></div>}
      </Card>
      <Card title="実際の Published Discovery Reader · 最近確認された 6 件"><ProductCards products={d.discovery.products}/></Card>
      <Card title="合成カタログ · Identity / Visibility"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">Product</th><th className="p-2">Visibility</th><th className="p-2">Domain Admin</th></tr></thead><tbody>{d.products.map(p=><tr key={p.id} className="border-t border-line"><td className="p-2"><p>{p.name}</p><p className="mt-1 text-ink-3">{p.slug}</p></td><td className="p-2">{p.visibility}</td><td className="p-2"><Link to={'/admin/aifind/products/'+p.id} className="text-accent">Admin</Link></td></tr>)}</tbody></table></div></Card>
    </div>
  </AdminPage>;
}
