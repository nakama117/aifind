import type { LbBoardEntry, LbPrice } from "../contracts.ts";
import { tokyoDate } from "@aihot/contracts/time";

export const boardHref = (key: string) => key === "overall" ? "/leaderboard" : `/leaderboard/boards/${key}`;
export const modelHref = (slug: string) => `/leaderboard/${encodeURIComponent(slug)}`;
export const sourceHref = (key: string) => `/leaderboard/sources/${encodeURIComponent(key)}`;
export const score = (n: number | null | undefined) => n == null ? "—" : n.toFixed(1);
export const percent = (n: number) => `${(n * 100).toFixed(1)}%`;

export function stamp(value: string | null | undefined, precision: "day" | "minute" = "minute"): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "未確認";
  if (precision === "day") return `${tokyoDate(value).replaceAll("-", "/")} JST`;
  return new Intl.DateTimeFormat("ja-JP", {timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value)) + " JST";
}

export function price(value: LbPrice | null, side: "input" | "output" | "cached" = "input"): string {
  if (!value || value[side] == null) return "未確認";
  return `${value.currency} ${new Intl.NumberFormat("ja-JP",{maximumFractionDigits:4}).format(value[side])}`;
}

export type SortKey = "rank" | "score" | "input" | "output" | "coverage" | "released";

export function leaderboardSeo(input:{kind:string;key:string;path:string;title:string;base:string;publishedAt:string|null;entries?:Array<{rank:number;model:{name:string;slug:string}}>}) {
  const path=input.kind==='board'?boardHref(input.key):input.path.split('?')[0]!;
  const base=input.base.replace(/\/+$/,'');
  const page:Record<string,unknown>={'@context':'https://schema.org','@type':input.kind==='board'?'CollectionPage':'WebPage',name:input.title,url:base+path,inLanguage:'ja-JP'};
  if(input.publishedAt)page.dateModified=input.publishedAt;
  if(input.kind==='board'&&input.publishedAt) page.mainEntity={
    '@type':'ItemList',itemListOrder:'https://schema.org/ItemListOrderAscending',
    itemListElement:(input.entries??[]).map(e=>({'@type':'ListItem',position:e.rank,name:e.model.name,url:base+modelHref(e.model.slug)})),
  };
  const crumbs=[{name:'モデルランキング',path:'/leaderboard'},...(path==='/leaderboard'?[]:[{name:input.title,path}])];
  return {path,noindex:input.kind==='board'&&!input.publishedAt,jsonLd:[page,{'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:base+c.path}))}]};
}

export function selectEntries(entries: LbBoardEntry[], filters: {domestic: boolean; open: boolean; sort: SortKey; query?: string}): LbBoardEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? "";
  const rows = entries.filter(e => (!filters.domestic || e.access.domestic) && (!filters.open || !!e.access.weightsUrl))
    .sort((a,b)=>a.rank-b.rank).slice(0,30)
    .filter(e=>!query || `${e.model.name} ${e.model.provider ?? ""}`.toLowerCase().includes(query));
  const value = (e: LbBoardEntry): number | null => {
    if (filters.sort === "score") return e.score;
    if (filters.sort === "input") return e.price?.inputCny ?? null;
    if (filters.sort === "output") return e.price?.outputCny ?? null;
    if (filters.sort === "coverage") return e.coverage;
    if (filters.sort === "released") return e.model.releasedAt ? Date.parse(e.model.releasedAt) : null;
    return e.rank;
  };
  const ascending = ["rank","input","output"].includes(filters.sort);
  return rows.sort((a,b)=>{
    const av=value(a),bv=value(b);
    if(av==null)return bv==null?a.rank-b.rank:1;
    if(bv==null)return -1;
    return (ascending?av-bv:bv-av)||a.rank-b.rank;
  });
}
