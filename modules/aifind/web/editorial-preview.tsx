import { Link,useLoaderData } from 'react-router';
import { adminGet } from '@aihot/web/lib/admin.server';
import { AdminPage,Badge,Card,DataTable } from '../../../apps/web/app/features/admin/ui.tsx';
import type { EditorialPreview } from '../preview/editorial-service.ts';
import { AdminNav,adminHeaders,adminMeta } from './admin-common.tsx';
import { EditorialCards } from './editorial-view.tsx';
export const meta=()=>adminMeta('Phase 6 Editorial + Compare / Category Preview');export const headers=adminHeaders;
export const loader=({request}:{request:Request})=>adminGet<EditorialPreview>(request,'/api/admin/aifind/preview/compare-category');
export default function EditorialPreviewPage(){const d=useLoaderData<typeof loader>();return <AdminPage title="Phase 6 Editorial + Compare / Category" subtitle="[PREVIEW] [SYNTHETIC] 実際の Domain / Reader / Site API を使う管理者専用デモ。"><div lang="ja" className="space-y-5"><AdminNav/><p className="rounded-control bg-amber/10 p-4 text-sm">GET と起動では seed / Publish を行いません。保存済み Draft を Preview で確認してから、人が操作理由を入力して Publish してください。実在する製品の評価ではありません。</p>
  <Card title="Editorial Domain の現在の状態"><DataTable rows={d.documents} rowKey={v=>v.id} empty="未 seed です。明示的な local seed の実行後に表示されます。" columns={[{key:'title',label:'編集ドキュメント',render:v=><Link className="break-words text-accent underline" to={'/admin/aifind/'+(v.type==='comparison'?'compare':'categories')+'/'+v.id}>{v.draft?.content.title??v.published?.content.title}</Link>},{key:'type',label:'種類',render:v=>v.type},{key:'state',label:'状態',render:v=><Badge tone={v.state==='published'?'ok':'warn'}>{v.state}</Badge>},{key:'versions',label:'Revision',render:v=>`Published r${v.published?.revisionNo??'なし'} / Draft r${v.draft?.revisionNo??'なし'}`}]}/></Card>
  {d.comparisons.length>0&&<Card title="公開 Reader の比較"><EditorialCards documents={d.comparisons}/></Card>}{d.categories.length>0&&<Card title="公開 Reader の用途ページ"><EditorialCards documents={d.categories}/></Card>}
  <Card title="P01–P24 検証シナリオ"><p className="mb-3 text-xs text-ink-3">これは検証項目の一覧です。PASS は実行結果の報告で確認します。</p><ul className="grid gap-2 text-xs sm:grid-cols-2">{d.cases.map(c=><li key={c.id}>{c.id} · {c.name}</li>)}</ul></Card>
  </div></AdminPage>;}
