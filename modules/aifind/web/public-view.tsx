import { Link } from "react-router";
import type { PublicProduct } from "../public-contracts.ts";
import {capabilityLabels} from '../discovery/contracts.ts';

export const publicLabels:Record<string,string>={unknown:"未確認",available:"利用可能",unavailable:"利用不可",restricted:"条件付き",waitlist:"順番待ち",full:"対応",partial:"一部対応",none:"非対応",active:"提供中",beta:"ベータ",discontinued:"提供終了",acquired:"買収済み"};
export function Status({value}:{value:string}) {
  const tone=value==='unknown'?'border-dashed border-line bg-bg-sunk text-ink-3':value==='unavailable'||value==='none'?'border-hot/30 bg-hot-soft text-hot':value==='full'||value==='available'||value==='active'?'border-ok/30 bg-ok/10 text-ok':'border-amber/30 bg-amber/10 text-ink';
  return <span data-status={value} className={`inline-flex rounded-control border px-2 py-1 text-xs font-medium ${tone}`}>{publicLabels[value]??value}</span>;
}
export function VerifiedDate({at}:{at:string}) {
  return <time dateTime={at}>{new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'}).format(new Date(at))}</time>;
}
export function nativeAmount(amountMinor:number,currency:NonNullable<PublicProduct['plans'][number]['prices'][number]['currencyCode']>):string {
  const value=BigInt(amountMinor),scale=currency==='JPY'?1n:100n;
  const whole=(value/scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const cents=scale===1n?'':(value%scale).toString().padStart(2,'0').replace(/0+$/,'');
  return {JPY:'¥',USD:'$',EUR:'€',GBP:'£'}[currency]+whole+(cents?'.'+cents:'');
}
export function priceLabel(p:PublicProduct['plans'][number]['prices'][number]):string {
  if(p.priceType==='unknown') return '料金未確認';
  if(p.priceType==='custom') return '要問い合わせ';
  if(p.priceType==='free') return '無料';
  const amount=nativeAmount(p.amountMinor!,p.currencyCode!)+(p.priceType==='from'?'〜':'');
  const period={month:'月',year:'年',usage:'従量',one_time:'一回',custom:'個別条件',none:''}[p.billingPeriod];
  return amount+(period?' / '+period:'');
}
export function freePlanLabel(p:Pick<PublicProduct,'hasCurrentFreePlan'|'freePlanState'>):string {
  const state=p.freePlanState??(p.hasCurrentFreePlan?'free':'unknown');
  return {free:'無料プランあり',trial:'無料トライアルのみ',paid:'有料プランのみ',custom:'要問い合わせ',unknown:'未確認'}[state];
}
export function ProductCards({products}:{products:PublicProduct[]}) {
  return <div className="grid gap-4 md:grid-cols-2">{products.map(p=><article key={p.slug} data-product-card={p.slug} className="min-w-0 rounded-panel bg-surface p-5 ring-1 ring-line">
    <p className="break-words text-xs text-ink-3">{p.vendor?.name??'提供元未設定'}</p>
    <h2 className="mt-2 break-words text-lg font-semibold"><Link className="text-ink hover:text-accent" to={'/products/'+p.slug}>{p.displayName}</Link></h2>
    <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-ink-2">{p.summaryJa}</p>
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-2">{p.capabilities.filter(c=>c.supportLevel==='full').slice(0,4).map(c=><span key={c.capabilityKey} className="rounded-control bg-bg-sunk px-2 py-1">{capabilityLabels[c.capabilityKey]}</span>)}</div>
    <dl className="mt-4 space-y-2 text-xs"><div className="flex flex-wrap items-center gap-2"><dt className="text-ink-3">日本での利用</dt><dd><Status value={p.markets.find(m=>m.marketCode==='JP')!.availabilityStatus}/></dd></div>
      <div className="flex flex-wrap items-center gap-2"><dt className="text-ink-3">日本語入力</dt><dd><Status value={p.japanese.inputSupport}/></dd><dt className="text-ink-3">出力</dt><dd><Status value={p.japanese.outputSupport}/></dd></div>
      <div className="flex flex-wrap items-center gap-2"><dt className="text-ink-3">日本語 UI</dt><dd><Status value={p.japanese.uiSupport}/></dd></div>
      <div className="flex flex-wrap gap-2"><dt className="text-ink-3">無料プラン</dt><dd data-free-plan-state={p.freePlanState??(p.hasCurrentFreePlan?'free':'unknown')}>{freePlanLabel(p)}</dd></div>
      <div className="flex flex-wrap gap-2"><dt className="text-ink-3">最終確認</dt><dd><VerifiedDate at={p.lastVerifiedAt}/></dd></div></dl>
  </article>)}</div>;
}
