import { data,redirect,useLoaderData,Link } from "react-router";
import { SITE } from "@aihot/site";
import { loadOr404 } from "@aihot/web/lib/api.server";
import { pageMeta } from "@aihot/web/lib/seo";
import type { PublicProduct,PublicProductResolution } from "../public-contracts.ts";
import { Status,VerifiedDate,priceLabel,freePlanLabel } from "./public-view.tsx";
import { EditorialCards } from './editorial-view.tsx';

export const handle={tab:'products',name:'製品情報'};
export const headers=({loaderHeaders}:{loaderHeaders:Headers})=>({'Cache-Control':'no-store',...(loaderHeaders.get('X-Robots-Tag')?{'X-Robots-Tag':loaderHeaders.get('X-Robots-Tag')!}:{})});
export async function loader({request,params}:{request:Request;params:{slug?:string}}) {
  const r=await loadOr404<PublicProductResolution>('/api/site/aifind/products/'+encodeURIComponent(params.slug??''),{signal:request.signal});
  if(r.kind==='redirect') throw redirect('/products/'+r.slug,{status:301,headers:{'Cache-Control':'no-store'}});
  if(r.kind!=='found') throw data({message:'not_found'},{status:404,headers:{'Cache-Control':'no-store'}});
  return data(r.product,{headers:{'Cache-Control':'no-store',...(r.product.visibility==='unlisted'?{'X-Robots-Tag':'noindex,follow'}:{})}});
}
export function meta({loaderData:p}:{loaderData?:PublicProduct}) {
  if(!p) return pageMeta({title:'製品が見つかりません',path:'/products',noindex:true});
  const description=[...p.summaryJa.replace(/\s+/g,' ').trim()].slice(0,160).join('');
  const base=new URL(p.canonicalUrl).origin;
  const tags=pageMeta({title:`${p.displayName}とは？料金・日本語対応・機能 | ${SITE.name}`,rawTitle:true,description,path:'/products/'+p.slug,image:base+'/og/products/'+p.slug+'.png',
    jsonLd:{'@context':'https://schema.org','@type':'SoftwareApplication',name:p.displayName,description:p.summaryJa,url:p.canonicalUrl,...(p.vendor?{provider:{'@type':'Organization',name:p.vendor.name}}:{})}});
  return [...tags.filter(tag=>!(('rel' in tag&&tag.rel==='canonical')||('property' in tag&&tag.property==='og:url'))),
    {tagName:'link',rel:'canonical',href:p.canonicalUrl},{property:'og:url',content:p.canonicalUrl},
    ...(p.visibility==='unlisted'?[{name:'robots',content:'noindex,follow'}]:[])];
}
const platformLabels:Record<string,string>={web:'Web',ios:'iOS',android:'Android',windows:'Windows',macos:'macOS',linux:'Linux',browser_extension:'ブラウザー拡張'};
const capabilityLabels:Record<string,string>={text:'文章作成',image_generation:'画像生成',image_understanding:'画像理解',video_generation:'動画生成',audio:'音声',coding:'コード作成',search:'検索',research:'調査',agent:'エージェント',api:'API'};
const sourceLabels:Record<string,string>={official_product:'公式製品情報',official_pricing:'公式料金表',official_docs:'公式ドキュメント',official_support:'公式サポート',official_blog:'公式ブログ',official_terms:'公式規約',reputable_media:'メディア',other:'その他'};
function Section({title,children}:{title:string;children:React.ReactNode}) {return <section className="min-w-0 rounded-panel bg-surface p-5 ring-1 ring-line"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;}
export default function PublicProductPage() {
  const p=useLoaderData<typeof loader>();
  return <article lang="ja" data-public-product className="min-w-0 space-y-6 pb-8">
    <Link className="text-sm text-accent hover:underline" to="/products">← AIを探す</Link>
    <header className="space-y-4"><p className="break-words text-sm text-ink-3">{p.vendor?.name??'提供元未設定'}</p><h1 className="break-words text-2xl font-semibold leading-snug text-ink sm:text-3xl">{p.displayName}</h1>
      {p.displayName.startsWith('[PREVIEW]')&&<p className="rounded-control border border-amber/30 bg-amber/10 p-3 text-xs leading-5">[PREVIEW] 合成デモです。実在する製品の情報・料金ではありません。</p>}
      <p className="whitespace-pre-line break-words text-base leading-7 text-ink-2">{p.summaryJa}</p>
      <div className="flex flex-wrap items-center gap-3"><Status value={p.lifecycleStatus}/><a href={p.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-control bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">公式サイトへ ↗</a></div>
      <p data-last-verified className="text-xs text-ink-3">最終確認：<VerifiedDate at={p.lastVerifiedAt}/>（日本時間）</p>
    </header>
    <div className="grid items-start gap-5 md:grid-cols-2"><Section title="日本での利用"><dl className="space-y-3">{p.markets.map(m=><div key={m.marketCode} className="flex flex-wrap items-center justify-between gap-2 text-sm"><dt>{m.marketCode==='JP'?'日本 (JP)':'米国 (US)'}</dt><dd><Status value={m.availabilityStatus}/></dd></div>)}</dl></Section>
      <Section title="日本語対応"><dl className="space-y-3">{(['input','output','ui'] as const).map(key=><div key={key} {...{['data-japanese-'+key]:true}} className="flex flex-wrap items-center justify-between gap-2 text-sm"><dt>{{input:'日本語入力',output:'日本語出力',ui:'日本語 UI'}[key]}</dt><dd><Status value={p.japanese[`${key}Support`]}/></dd></div>)}</dl></Section></div>
    <Section title="対応プラットフォーム"><dl className="grid gap-3 sm:grid-cols-2">{p.platforms.filter(f=>f.status!=='unknown').map(f=><div key={f.platformKey} data-platform={f.platformKey} data-state={f.status} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-bg-sunk p-3 text-sm"><dt>{platformLabels[f.platformKey]}</dt><dd><Status value={f.status}/></dd></div>)}</dl>
      {p.platforms.some(f=>f.status==='unknown')&&<details data-unknown-platforms className="mt-4 text-sm text-ink-3"><summary className="cursor-pointer">公式資料で確認できなかったプラットフォーム</summary><p className="my-3 text-xs">未確認は利用不可を意味しません。Web、CLI、ネイティブアプリと拡張機能は区別しています。</p><dl className="grid gap-3 sm:grid-cols-2">{p.platforms.filter(f=>f.status==='unknown').map(f=><div key={f.platformKey} data-platform={f.platformKey} data-state="unknown" className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-bg-sunk p-3"><dt>{platformLabels[f.platformKey]}</dt><dd><Status value="unknown"/></dd></div>)}</dl></details>}
    </Section>
    <Section title="機能・用途"><p className="mb-4 text-xs leading-5 text-ink-3">利用できる機能はプラン・地域・接続モデルで異なります。「一部対応」には特定の画面や公式連携で使える機能も含みます。</p><dl className="grid gap-3 sm:grid-cols-2">{p.capabilities.filter(f=>f.supportLevel!=='unknown').map(f=><div key={f.capabilityKey} data-capability={f.capabilityKey} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-bg-sunk p-3 text-sm"><dt>{capabilityLabels[f.capabilityKey]} <span className="text-xs text-ink-3">({f.capabilityKey})</span></dt><dd><Status value={f.supportLevel}/></dd></div>)}</dl>
      {p.capabilities.some(f=>f.supportLevel==='unknown')&&<details data-unknown-capabilities className="mt-4 text-sm text-ink-3"><summary className="cursor-pointer">公式資料で確認できなかった機能</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{p.capabilities.filter(f=>f.supportLevel==='unknown').map(f=><div key={f.capabilityKey} data-capability={f.capabilityKey} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-bg-sunk p-3"><dt>{capabilityLabels[f.capabilityKey]}</dt><dd><Status value="unknown"/></dd></div>)}</dl></details>}
    </Section>
    <Section title="プラン・料金"><p data-free-plan-state={p.freePlanState??'unknown'} className="mb-3 font-medium">{freePlanLabel(p)}</p><p className="mb-4 text-xs leading-5 text-ink-3">確認時点の情報です。通貨の換算は行いません。年払いの月額換算・1席あたり・初月の条件は各料金に記載しています。最新の条件は公式サイトをご確認ください。</p>
      {p.plans.length?<div className="space-y-4">{p.plans.map(plan=><section key={plan.planKey} className="min-w-0 rounded-control border border-line p-4"><h3 className="break-words font-semibold">{plan.name}{plan.activeStatus==='inactive'&&<span className="ml-2 text-xs text-hot">提供停止</span>}</h3>
        {plan.prices.length?<div className="mt-3 space-y-3">{plan.prices.map((r,i)=><div key={i} data-price-type={r.priceType} className="min-w-0 border-t border-line pt-3"><p className="break-words text-lg font-semibold text-ink">{priceLabel(r)}</p><p className="mt-1 break-words text-xs leading-5 text-ink-3">{[r.marketCode?`対象市場：${r.marketCode}`:null,r.currencyCode?`通貨：${r.currencyCode}`:null,r.unitLabel].filter(Boolean).join(' · ')}</p>
          {(r.validFrom||r.validTo)&&<p className="mt-1 text-xs text-ink-3">有効期間：{r.validFrom??'開始日未確認'} → {r.validTo??'終了日未確認'}</p>}</div>)}</div>:<p className="mt-2 text-sm text-ink-3">料金情報はまだ確認できていません。</p>}</section>)}</div>:<p className="text-sm text-ink-3">料金情報はまだ確認できていません。</p>}
    </Section>
    <Section title="情報の根拠"><ul data-public-evidence className="space-y-4 text-sm">{p.evidence.map((e,i)=><li key={i} className="min-w-0 border-b border-line pb-3 last:border-0"><span className="break-words text-xs text-ink-3">{sourceLabels[e.sourceKind]}{e.publisher?' · '+e.publisher:''}</span><a className="mt-1 block break-words text-accent hover:underline" href={e.url} target="_blank" rel="noopener noreferrer">{e.title??e.url} ↗</a><span className="mt-1 block break-all text-xs text-ink-3">{e.url}</span></li>)}</ul></Section>
    {p.relatedEditorial?.comparisons.length?<Section title="この製品を含む比較"><div data-related-comparisons><EditorialCards documents={p.relatedEditorial.comparisons}/></div></Section>:null}
    {p.relatedEditorial?.categories.length?<Section title="用途から探す"><div data-related-categories><EditorialCards documents={p.relatedEditorial.categories}/></div></Section>:null}
    {p.relatedEditorial?.guides?.length?<Section title="この製品の使い方"><div data-related-guides><EditorialCards documents={p.relatedEditorial.guides}/></div></Section>:null}
    <p className="break-all text-xs text-ink-3">この製品の公開 URL：<a className="text-accent" href={p.canonicalUrl}>{p.canonicalUrl}</a></p>
  </article>;
}
