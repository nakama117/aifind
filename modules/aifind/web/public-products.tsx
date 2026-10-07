import { data,useLoaderData,Link,Form } from "react-router";
import { loadOr404 } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import type { PublicProductList } from "../public-contracts.ts";
import { ProductCards } from "./public-view.tsx";
import {DiscoveryQuerySchema,capabilityLabels,platformLabels,shortcutCapabilities} from '../discovery/contracts.ts';

export const handle={tab:'products',name:'AIを探す'};
export const headers=({loaderHeaders}:{loaderHeaders?:Headers}={})=>({'Cache-Control':'no-store',...(loaderHeaders?.get('X-Robots-Tag')?{'X-Robots-Tag':loaderHeaders.get('X-Robots-Tag')!}:{})});
export async function loader({request}:{request:Request}) {
  const params=new URL(request.url).searchParams,page=Number(params.get('page')??1);
  if(!Number.isInteger(page)||page<1||page>10000||[...params.keys()].some(k=>params.getAll(k).length>1))throw data({message:'invalid_query'},{status:400,headers:headers()});
  const values=Object.fromEntries([...params].filter(([k,v])=>k!=='page'&&v!==''));
  const parsed=DiscoveryQuerySchema.safeParse({...values,limit:24,offset:(page-1)*24});
  if(!parsed.success)throw data({message:'invalid_query'},{status:400,headers:headers()});
  const query=parsed.data,filtered=!!(query.q||query.capability||query.platform||query.japan||query.japanese||query.free||values.sort);
  const apiParams=new URLSearchParams(Object.entries(query).map(([k,v])=>[k,String(v)]));
  const result=await loadOr404<PublicProductList>('/api/site/aifind/products?'+apiParams,{signal:request.signal});
  return data({...result,page,filtered},{headers:{...headers(),...(filtered?{'X-Robots-Tag':'noindex,follow'}:{})}});
}
export const meta=({loaderData}:{loaderData?:{page:number;filtered:boolean}})=>pageMeta({title:'AIを探す',description:'いま使えるAIを、用途や対応状況から確認できます。',noindex:loaderData?.filtered,path:'/products'+(loaderData&&!loaderData.filtered&&loaderData.page>1?'?page='+loaderData.page:'')});
export default function PublicProductsPage() {
  const p=useLoaderData<typeof loader>(),q=p.query;
  const next=(page:number)=>{const sp=new URLSearchParams();for(const [k,v] of Object.entries(q))if(!['limit','offset'].includes(k)&&v!==''&&!(k==='sort'&&v==='recently_verified'&&!p.filtered))sp.set(k,String(v));if(page>1)sp.set('page',String(page));return '/products'+(sp.size?'?'+sp:'');};
  const control='mt-1 w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink';
  return <div lang="ja" className="space-y-6 pb-8"><header><h1 className="text-2xl font-semibold text-ink">AIを探す</h1><p className="mt-3 text-sm leading-6 text-ink-2">いま使えるAIを、用途や対応状況から確認できます。</p></header>
    <nav aria-label="用途から探す" className="flex flex-wrap gap-2">{shortcutCapabilities.map(key=><Link key={key} data-capability-shortcut to={'/products?capability='+key} className="rounded-control border border-line px-3 py-2 text-sm text-accent">{capabilityLabels[key]}</Link>)}</nav>
    <Form method="get" action="/products" key={JSON.stringify(q)} className="space-y-4 rounded-panel bg-surface p-4 ring-1 ring-line">
      <div><label htmlFor="discovery-q" className="text-sm font-medium">製品名・別名・提供元で検索</label><input id="discovery-q" type="search" name="q" maxLength={200} defaultValue={q.q} className={control} placeholder="例：文章作成ツールの名前"/></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">用途<select name="capability" defaultValue={q.capability??''} className={control}><option value="">すべての用途</option>{Object.entries(capabilityLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
        <label className="text-sm">プラットフォーム<select name="platform" defaultValue={q.platform??''} className={control}><option value="">すべて</option>{Object.entries(platformLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
        <label className="text-sm">並び順<select name="sort" defaultValue={q.sort} className={control}><option value="recently_verified">最近確認された順</option><option value="recently_published">最近公開された順</option><option value="name">名前順</option></select></label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm"><label><input type="checkbox" name="japan" value="available" defaultChecked={!!q.japan}/> 日本で利用可能</label><label><input type="checkbox" name="japanese" value="usable" defaultChecked={!!q.japanese}/> 日本語入力・出力に対応</label><label><input type="checkbox" name="free" value="true" defaultChecked={!!q.free}/> 確認済みの無料プラン</label></div>
      <p className="text-xs leading-5 text-ink-3">未確認・一部対応は対応条件に含めません。日本語 UI は各製品で別に表示します。提供元の検索は、その提供元の製品を表示します。</p>
      <div className="flex items-center gap-4"><button className="rounded-control bg-accent px-4 py-2 text-sm text-white" type="submit">検索・絞り込み</button><Link data-clear-discovery to="/products" className="text-sm text-accent">条件をクリア</Link></div>
    </Form>
    <div aria-live="polite" className="space-y-2"><p data-discovery-count className="text-sm font-medium">{p.total} 件の製品 · {p.page} ページ目</p><p data-active-filters className="break-words text-xs text-ink-3">{[q.q&&`検索：${q.q}`,q.capability&&capabilityLabels[q.capability],q.platform&&platformLabels[q.platform],q.japan&&'日本で利用可能',q.japanese&&'日本語入力・出力',q.free&&'無料プラン'].filter(Boolean).join(' / ')||'すべての公開製品'}</p></div>
    {p.products.length?<ProductCards products={p.products}/>:<p data-no-products className="rounded-panel bg-surface p-6 text-sm text-ink-3 ring-1 ring-line">条件に一致する製品が見つかりません。条件を減らすか、別の名前で検索してください。</p>}
    {(p.page>1||p.hasMore)&&<nav aria-label="製品一覧のページ" className="flex justify-between text-sm text-accent">{p.page>1?<Link to={next(p.page-1)}>前のページ</Link>:<span/>}{p.hasMore&&<Link to={next(p.page+1)}>次のページ</Link>}</nav>}
  </div>;
}
