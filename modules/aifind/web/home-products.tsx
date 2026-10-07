import { Link } from "react-router";
import type { HomePagePart } from "@aihot/web/modules";
import type { PublicProductList } from "../public-contracts.ts";
import { ProductCards } from "./public-view.tsx";
import {shortcutCapabilities,capabilityLabels} from '../discovery/contracts.ts';
import type { PublicEditorialSummary } from '../editorial/public-contracts.ts';
import { EditorialCards } from './editorial-view.tsx';
import {SITE} from '@aihot/site';

export default { apiPath:'/api/site/aifind/home', Block:({data}:{data:unknown})=>{
  const {products,comparisons=[],categories=[],guides=[]}=data as PublicProductList & {comparisons:PublicEditorialSummary[];categories:PublicEditorialSummary[];guides?:PublicEditorialSummary[]};
  if(!products.length&&!comparisons.length&&!categories.length&&!guides.length) return null;
  return <><header lang="ja" data-aifind-home-intro className="mb-7 rounded-card border border-line bg-surface p-5"><p className="text-xs text-ink-3">{SITE.name} · アイファインド</p><h2 className="mt-2 text-xl font-semibold">{SITE.tagline}</h2><p className="mt-3 text-sm leading-6 text-ink-2">AIを知る、比べる、使いこなす。公式資料で確認した情報と出典から、目的に合うAIを探せます。</p><Link to="/all" className="mt-3 inline-block text-sm text-accent hover:underline">AIニュースを読む →</Link></header>{products.length>0&&<section lang="ja" data-home-products className="mb-7 mt-4 space-y-4"><header className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">最近確認されたAI</h2><Link to="/products" className="text-sm text-accent hover:underline">AIを探す →</Link></header>
    <form method="get" action="/products" className="flex flex-wrap gap-2"><label htmlFor="home-product-q" className="sr-only">製品名・別名・提供元で検索</label><input id="home-product-q" name="q" type="search" maxLength={200} placeholder="製品名・別名・提供元で検索" className="min-w-0 flex-1 rounded-control border border-line bg-surface px-3 py-2 text-sm"/><button type="submit" className="rounded-control bg-accent px-4 py-2 text-sm text-white">探す</button></form>
    <nav aria-label="AIの用途" className="flex flex-wrap gap-2">{shortcutCapabilities.map(k=><Link data-capability-shortcut key={k} to={'/products?capability='+k} className="rounded-control border border-line px-3 py-2 text-xs text-accent">{capabilityLabels[k]}</Link>)}</nav><ProductCards products={products}/></section>}
    {comparisons.length>0&&<section data-home-comparisons className="mb-7 space-y-4"><h2 className="text-lg font-semibold"><Link to="/compare">AIを比べる →</Link></h2><EditorialCards documents={comparisons}/></section>}
    {categories.length>0&&<section data-home-categories className="mb-7 space-y-4"><h2 className="text-lg font-semibold"><Link to="/categories">用途から探す →</Link></h2><EditorialCards documents={categories}/></section>}{guides.length>0&&<section data-home-guides className="mb-7 space-y-4"><h2 className="text-lg font-semibold"><Link to="/howto">使い方 →</Link></h2><EditorialCards documents={guides}/></section>}</>;
} } satisfies HomePagePart;
