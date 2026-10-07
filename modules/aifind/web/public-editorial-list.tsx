import { data,useLoaderData } from 'react-router';
import { loadOr404 } from '@aihot/web/lib/api.server';
import { pageMeta } from '@aihot/web/lib/seo';
import type { PublicEditorialSummary } from '../editorial/public-contracts.ts';
import { EditorialCards } from './editorial-view.tsx';
export const headers=()=>({'Cache-Control':'no-store'});export const handle={tab:'compare',name:'編集ページ'};
export async function loader({request}:{request:Request}){const path=new URL(request.url).pathname==='/categories'?'categories':new URL(request.url).pathname==='/howto'?'howto':'compare';return data({path,documents:await loadOr404<PublicEditorialSummary[]>('/api/site/aifind/'+path,{signal:request.signal})},{headers:headers()});}
export const meta=({loaderData:d}:{loaderData?:{path:string}})=>pageMeta({title:d?.path==='categories'?'用途から探す':d?.path==='howto'?'AIを使う · 使い方':'AIを比べる',description:'編集者が条件と根拠を確認した、AIの比較・用途ガイド。',path:'/'+(d?.path??'compare')});
export default function PublicEditorialList(){const{path,documents}=useLoaderData<typeof loader>();return <div lang="ja" className="space-y-6 pb-8"><header><h1 className="text-2xl font-semibold">{path==='compare'?'AIを比べる':path==='howto'?'AIを使う · 使い方':'用途から探す'}</h1><p className="mt-3 text-sm leading-6 text-ink-2">{path==='compare'?'同じ問いで、製品の現在の事実と編集時の判断を比べます。':path==='howto'?'できること、手順、失敗例と限界を確認します。公式資料の解説と実測記録を区別して表示します。':'用途と条件を確認し、編集者が選んだ候補を探します。掲載順は順位ではありません。'}</p></header>{documents.length?<EditorialCards documents={documents}/>:<p data-no-editorial className="rounded-panel bg-surface p-6 text-sm text-ink-3 ring-1 ring-line">公開できる編集ページはまだありません。</p>}</div>;}
