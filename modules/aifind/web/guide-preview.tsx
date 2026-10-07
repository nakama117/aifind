import { Link, useLoaderData } from 'react-router';
import { adminGet } from '@aihot/web/lib/admin.server';
import { AdminPage, Badge, Card, DataTable } from '../../../apps/web/app/features/admin/ui.tsx';
import { AdminNav, adminHeaders, adminMeta } from './admin-common.tsx';
import type { GuidePreview } from '../preview/guide-service.ts';
import { EditorialCards } from './editorial-view.tsx';
export const headers=adminHeaders;export const meta=()=>adminMeta('Phase 7 Guide Preview');
export function loader({request}:{request:Request}){return adminGet<GuidePreview>(request,'/api/admin/aifind/preview/howto-guide');}
export default function GuidePreviewPage(){const d=useLoaderData<typeof loader>();return <AdminPage title="Phase 7 · How-to / Guide + Media" subtitle="[PREVIEW] [SYNTHETIC] 実際の Editorial / Product Reader を使う管理者専用 Preview。"><div lang="ja" className="space-y-5"><AdminNav/>
  <Card title="安全な表示・操作テスト"><p className="text-sm leading-6">GET や起動時に seed / Publish は実行しません。合成データは明示的な local fixture のみです。以下の項目は検証手順であり、表示だけで PASS を意味しません。公開・非公開・Retest を各管理ページで確認します。</p></Card>
  <Card title="Guide Documents"><DataTable rows={d.documents} rowKey={r=>r.id} columns={[{key:'title',label:'Guide',render:r=><Link className="text-accent underline" to={'/admin/aifind/howto/'+r.id}>{r.draft?.content.title??r.published?.content.title}</Link>},{key:'state',label:'状態',render:r=><Badge>{r.state}</Badge>},{key:'versions',label:'Revision',render:r=>`Published ${r.published?.revisionNo??'なし'} / Draft ${r.draft?.revisionNo??'なし'}`},{key:'public',label:'公開ページ',render:r=>r.state==='published'?<Link className="text-accent underline" to={'/howto/'+r.publicSlug}>公開版を確認</Link>:<span>非公開</span>}]}/></Card>
  {d.guides.length>0&&<Card title="eligible Published Guides"><EditorialCards documents={d.guides}/></Card>}
  <Card title="P01–P26 検証項目"><ol className="grid gap-3 text-sm sm:grid-cols-2">{d.cases.map(c=><li key={c.id}><strong>{c.id}</strong> · {c.name}</li>)}</ol></Card>
  <Card title="関連する入口"><div className="flex flex-wrap gap-4 text-sm text-accent"><Link to="/admin/aifind/howto">Guide 管理</Link><Link to="/howto">使い方</Link><Link to="/admin/aifind/products">Product の Draft / Publish</Link><Link to="/sitemap-aifind-editorial.xml">Editorial sitemap</Link></div></Card>
</div></AdminPage>;}
