import type { ReactNode } from "react";
import { tokyoDate, tokyoTime } from "@aihot/contracts/time";
import type { ProductSnapshot, ProductPrice, Verification } from "../contracts.ts";
import { formatAmountMinor } from "../admin/contracts.ts";

const states: Record<string, [string, string]> = {
  available: ["利用可能", "bg-ok/10 text-ok ring-ok/20"], unavailable: ["利用不可", "bg-hot-soft text-hot ring-hot/25"],
  unknown: ["未確認", "bg-bg-sunk text-ink-3 ring-line"], restricted: ["条件付き", "bg-amber/10 text-amber ring-amber/25"],
  waitlist: ["順番待ち", "bg-amber/10 text-amber ring-amber/25"],
  full: ["対応", "bg-ok/10 text-ok ring-ok/20"], partial: ["一部対応", "bg-amber/10 text-amber ring-amber/25"],
  none: ["非対応", "bg-hot-soft text-hot ring-hot/25"], active: ["提供中", "bg-ok/10 text-ok ring-ok/20"],
  beta: ["ベータ", "bg-amber/10 text-amber ring-amber/25"], discontinued: ["提供終了", "bg-hot-soft text-hot ring-hot/25"],
  acquired: ["買収済み", "bg-bg-sunk text-ink-3 ring-line"],
};
export function State({ value }: { value: string }) {
  const [label, tone] = states[value] ?? [value, "bg-bg-sunk text-ink-3 ring-line"];
  return <span data-state={value} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`}>{label} ({value})</span>;
}
export function At({ at }: { at: string | null }) {
  return at ? <time dateTime={at} className="num">{tokyoDate(at)} {tokyoTime(at)} JST</time> : <span className="text-ink-3">未確認</span>;
}
function Field({ label, children, field }: { label: string; children: ReactNode; field?: string }) {
  return <div data-field={field} className="min-w-0"><dt className="text-xs text-ink-3">{label}</dt><dd className="mt-1 break-words text-sm text-ink">{children}</dd></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-t border-line px-4 py-4"><h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>{children}</section>;
}
function Verified({ fact, scope }: { fact: Verification; scope: string }) {
  return <p data-field="verifiedAt" className="mt-1 text-xs text-ink-3">verifiedAt: <At at={fact.verifiedAt} />
    {fact.evidenceId && <> · <a className="text-accent underline" href={`#${scope}-${fact.evidenceId}`}>根拠</a></>}
  </p>;
}
const periods = { month: "月", year: "年", usage: "従量", one_time: "一回", custom: "個別", none: "—" };
export function Price({ price }: { price: ProductPrice }) {
  let label: string;
  if (price.priceType === "unknown") label = "料金未確認 (unknown)";
  else if (price.priceType === "custom") label = "個別見積もり (custom)";
  else if (price.priceType === "free") label = "無料 (free)";
  else if (price.amountMinor === null || !price.currencyCode) label = "料金未確認";
  else {
    const amount = price.currencyCode === "JPY" ? `￥${new Intl.NumberFormat("ja-JP").format(price.amountMinor)}` : `${price.currencyCode} ${formatAmountMinor(price.amountMinor, price.currencyCode)}`;
    label = `${amount}${price.priceType === "from" ? "〜" : ""} (${price.priceType})`;
  }
  return <div data-price-type={price.priceType} className="text-sm font-medium text-ink">{label}
    <span className="ml-2 text-xs font-normal text-ink-3">{price.marketCode ?? "地域未確認"} · {periods[price.billingPeriod]}{price.unitLabel ? ` / ${price.unitLabel}` : ""}</span>
  </div>;
}

export function Snapshot({ product, kind, mark = true }: { product: ProductSnapshot | null; kind: "published" | "draft"; mark?: boolean }) {
  const scope = kind;
  const published = kind === "published";
  const facts: Verification[] = product ? [
    { evidenceId: product.version.lifecycleEvidenceId, verifiedAt: product.version.lifecycleVerifiedAt },
    ...product.markets, ...product.languages, ...product.platforms, ...product.capabilities,
    ...product.plans.flatMap(p => [p, ...p.prices]),
  ] : [];
  return <section data-version-status={mark ? kind : undefined} aria-label={published ? "Published version" : "Draft version"} className="min-w-0 overflow-hidden rounded-panel bg-surface ring-1 ring-line">
    <header className={`border-b border-line p-4 ${published ? "bg-ok/10" : "bg-amber/10"}`}>
      <h2 className="text-lg font-semibold text-ink">{published ? "Published · 公開済み" : "Draft · 下書き"} {product && <span className="num ml-2">v{product.version.versionNo}</span>}</h2>
      <p className="mt-1 text-xs text-ink-3">{published ? "Published Reader が返す現在の公開版" : "管理者だけが読める別バージョン。公開版には反映されません。"}</p>
      {product && <p className="mt-2 break-words text-sm font-medium text-ink">{product.version.displayName}</p>}
    </header>
    {!product ? <p className="p-4 text-sm text-ink-3">このバージョンはまだありません。</p> : <>
      <Section title="Product Identity / Versions"><dl className="grid grid-cols-2 gap-4">
        <Field label="Product">{product.identity.canonicalName}</Field>
        <Field label="Vendor">{product.vendor?.name ?? "未確認"}</Field>
        <Field label="Slug">{product.identity.slug}</Field>
        <Field label="status / version number">{product.version.status} / v{product.version.versionNo}</Field>
        <Field label="Lifecycle"><State value={product.version.lifecycleStatus} /></Field>
        <Field label="日本語の製品説明">{product.version.summaryJa??'未設定'}</Field>
        <Field label="lastVerifiedAt" field="lastVerifiedAt"><At at={product.lastVerifiedAt} /></Field>
      </dl><p className="mt-3 text-xs leading-relaxed text-ink-3">lastVerifiedAt は根拠がある明確な事実の最終確認時刻です。updated_at ではありません。</p></Section>
      <Section title="Market Availability"><div className="space-y-3">{product.markets.map(m => <div key={m.marketCode}>
        <span className="mr-2 text-sm font-medium">{m.marketCode}</span><State value={m.availabilityStatus} /><Verified fact={m} scope={scope} />
      </div>)}</div></Section>
      <Section title="Japanese Support"><div className="space-y-3">{product.languages.filter(l => l.languageCode === "ja").map(l => <div key={l.languageCode}>
        <dl className="grid grid-cols-3 gap-2"><Field label="Input"><State value={l.inputSupport} /></Field><Field label="Output"><State value={l.outputSupport} /></Field><Field label="UI"><State value={l.uiSupport} /></Field></dl>
        <Verified fact={l} scope={scope} />
      </div>)}</div></Section>
      <Section title="Platforms"><div className="grid gap-3 sm:grid-cols-2">{product.platforms.map(p => <div data-platform={p.platformKey} key={p.platformKey}>
        <div className="mb-1 text-xs font-medium text-ink-2">{p.platformKey}</div><State value={p.status} /><Verified fact={p} scope={scope} />
      </div>)}</div></Section>
      <Section title="Capabilities"><div className="grid gap-3 sm:grid-cols-2">{product.capabilities.map(c => <div key={c.capabilityKey}>
        <div className="mb-1 text-xs font-medium text-ink-2">{c.capabilityKey}</div><State value={c.supportLevel} /><Verified fact={c} scope={scope} />
      </div>)}</div></Section>
      <Section title="Plans / Prices"><div className="space-y-3">{product.plans.map(plan => <div key={plan.id} className="rounded-control bg-bg-sunk p-3">
        <h4 className="mb-1 text-xs text-ink-3">{plan.name} · {plan.planKey}</h4>
        {plan.prices.map(price => <div key={price.id}><Price price={price} /><Verified fact={price} scope={scope} /></div>)}
      </div>)}</div></Section>
      <Section title="Evidence"><div className="space-y-4">{product.evidence.map(e => {
        const times = [...new Set(facts.filter(f => f.evidenceId === e.id && f.verifiedAt).map(f => f.verifiedAt!))].sort();
        return <article id={`${scope}-${e.id}`} key={e.id} className="scroll-mt-6 rounded-control bg-bg-sunk p-3 text-xs">
          <h4 className="font-medium text-ink">{e.title ?? "根拠"}</h4>
          <p className="mt-1 text-ink-3">source kind: <span className="text-ink-2">{e.sourceKind}</span></p>
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-accent underline">{e.url}</a>
          <p className="mt-2 text-ink-3">参照事実の verifiedAt: {times.length ? times.map(at => <span key={at} className="mr-2"><At at={at} /></span>) : "未確認"}</p>
          <p className="mt-1 leading-relaxed text-ink-3">{e.evidenceNote}</p>
        </article>;
      })}</div></Section>
    </>}
  </section>;
}

