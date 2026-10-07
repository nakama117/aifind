import { useState } from 'react';
import { Link, useLoaderData, useNavigate } from 'react-router';
import { adminGet } from '@aihot/web/lib/admin.server';
import { useAdminAction } from '@aihot/web/features/admin/action';
import { AdminPage, Badge, Button, Card, DataTable, Field, Input } from '../../../apps/web/app/features/admin/ui.tsx';
import { AdminNav, adminHeaders, adminMeta, ReasonField } from './admin-common.tsx';
import type { EditorialAdminRow } from '../editorial/read.ts';
import type { EditorialAdminDetail } from '../editorial/contracts.ts';
import { emptyEditorial } from './editorial-editor.tsx';
export const meta=()=>adminMeta('編集ドキュメント');export const headers=adminHeaders;
export async function loader({request}:{request:Request}){const type=new URL(request.url).pathname.includes('/categories')?'category':new URL(request.url).pathname.includes('/howto')?'guide':'comparison',path=type==='category'?'categories':type==='guide'?'howto':'compare';return{type,path,rows:await adminGet<EditorialAdminRow[]>(request,'/api/admin/aifind/'+path)} as const;}
export default function EditorialList(){const {type,path,rows}=useLoaderData<typeof loader>(),{run,busy}=useAdminAction(),navigate=useNavigate();const [title,setTitle]=useState(''),[slug,setSlug]=useState(''),[reason,setReason]=useState('');return <AdminPage title={type==='comparison'?'比較の管理':type==='guide'?'使い方の管理':'用途ページの管理'} subtitle="人が編集し、保存・Preview・Publish を分けて管理します。"><div lang="ja" className="space-y-5"><AdminNav/>
  <Card pad={false}><DataTable rows={rows} rowKey={r=>r.id} empty="編集ドキュメントがありません。" columns={[{key:'title',label:'タイトル',render:r=><Link className="text-accent underline" to={'/admin/aifind/'+path+'/'+r.id}>{r.title||'タイトル未入力'}</Link>},{key:'state',label:'状態',render:r=><Badge tone={r.state==='published'?'ok':'warn'}>{r.state}</Badge>},{key:'revisions',label:'Revision',render:r=>`Published ${r.published_revision_no??'なし'} / Draft ${r.draft_revision_no??'なし'}`},{key:'slug',label:'公開 Slug',render:r=>r.public_slug??'未公開'}]}/></Card>
  <Card title="新しい Draft"><form className="space-y-3" onSubmit={async e=>{e.preventDefault();const d=await run<EditorialAdminDetail>('POST','/api/admin/aifind/'+path,{content:emptyEditorial(type,title,slug),reason},{success:'Draft を作成しました。',revalidate:false});if(d)navigate('/admin/aifind/'+path+'/'+d.id);}}><Field label="新しいタイトル"><Input aria-label="新しいタイトル" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={200}/></Field><Field label="新しい Slug"><Input aria-label="新しい Slug" value={slug} onChange={e=>setSlug(e.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100}/></Field><ReasonField value={reason} onChange={setReason}/><Button type="submit" busy={busy} disabled={!reason.trim()}>編集 Draft を作成</Button></form></Card>
  </div></AdminPage>;}
