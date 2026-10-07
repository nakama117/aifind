import { useState } from "react";
import type { z } from "zod";
import { Button, Field, Input } from "../../../apps/web/app/features/admin/ui.tsx";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { DraftSaveSchema, formatAmountMinor, parseAmountMinor } from "../admin/contracts.ts";
import { MARKET_CODES, LANGUAGE_CODES, SUPPORT_LEVELS, PLATFORM_KEYS, CAPABILITY_KEYS, LIFECYCLE_STATUSES, CURRENCY_CODES } from "../contracts.ts";
import type { DraftProduct, Evidence, ProductPrice } from "../contracts.ts";
import { Block, Choice, ProofFields, ReasonField } from "./admin-common.tsx";
import { At } from "./product-view.tsx";

type Save = z.infer<typeof DraftSaveSchema>;
type EditablePrice = Omit<NonNullable<Save["plans"]>[number]["prices"][number], "amountMinor"> & { amount: string };
type EditablePlan = Omit<NonNullable<Save["plans"]>[number], "prices"> & { prices: EditablePrice[] };
type Form = { version: NonNullable<Save["version"]>; markets: NonNullable<Save["markets"]>; languages: NonNullable<Save["languages"]>;
  platforms: NonNullable<Save["platforms"]>; capabilities: NonNullable<Save["capabilities"]>; plans: EditablePlan[] };
const unknownProof = { evidenceId: null, verifiedAt: null };
const verification = (p: { evidenceId?: string | null; verifiedAt?: string | null }) => ({ evidenceId: p.evidenceId ?? null, verifiedAt: p.verifiedAt ?? null });
function initial(p: DraftProduct): Form {
  return { version: { displayName: p.version.displayName, officialUrl: p.version.officialUrl, summaryJa: p.version.summaryJa, lifecycleStatus: p.version.lifecycleStatus,
    lifecycleEvidenceId: p.version.lifecycleEvidenceId, lifecycleVerifiedAt: p.version.lifecycleVerifiedAt },
    markets: MARKET_CODES.map(marketCode => { const f = p.markets.find(v => v.marketCode === marketCode); return { marketCode, availabilityStatus: f?.availabilityStatus ?? "unknown", ...verification(f ?? {}) }; }),
    languages: LANGUAGE_CODES.map(languageCode => { const f = p.languages.find(v => v.languageCode === languageCode); return { languageCode, inputSupport: f?.inputSupport ?? "unknown", outputSupport: f?.outputSupport ?? "unknown", uiSupport: f?.uiSupport ?? "unknown", ...verification(f ?? {}) }; }),
    platforms: p.platforms.map(f => ({ platformKey: f.platformKey, status: f.status, ...verification(f) })),
    capabilities: p.capabilities.map(f => ({ capabilityKey: f.capabilityKey, supportLevel: f.supportLevel, ...verification(f) })),
    plans: p.plans.map(f => ({ planKey: f.planKey, name: f.name, audience: f.audience, billingModel: f.billingModel, activeStatus: f.activeStatus, ...verification(f),
      prices: f.prices.map(price => ({ id: price.id, marketCode: price.marketCode, currencyCode: price.currencyCode, billingPeriod: price.billingPeriod,
        priceType: price.priceType, amount: price.amountMinor === null ? "" : formatAmountMinor(price.amountMinor, price.currencyCode), unitLabel: price.unitLabel,
        validFrom: price.validFrom, validTo: price.validTo, ...verification(price) })) })) };
}
export default function DraftEditor({ draft, revision, evidence }: { draft: DraftProduct; revision: number; evidence: Evidence[] }) {
  const [form, setForm] = useState(() => initial(draft)), [reason, setReason] = useState(""), [error, setError] = useState("");
  const { run, busy } = useAdminAction();
  const changePlan = (index: number, patch: Partial<EditablePlan>) => setForm(f => ({ ...f, plans: f.plans.map((p, i) => i === index ? { ...p, ...patch } : p) }));
  const changePrice = (index: number, priceIndex: number, patch: Partial<EditablePrice>) => setForm(f => ({ ...f, plans: f.plans.map((p, i) => i === index ? { ...p, prices: p.prices.map((v, j) => j === priceIndex ? { ...v, ...patch } : v) } : p) }));
  const proof = (label: string, fact: { evidenceId?: string | null; verifiedAt?: string | null }, onChange: (v: { evidenceId: string | null; verifiedAt: string | null }) => void) =>
    <ProofFields label={label} evidence={evidence} {...verification(fact)} onChange={onChange} />;
  return <form data-draft-editor className="space-y-4 text-sm" onSubmit={async e => {
    e.preventDefault(); setError("");
    try {
      const plans = form.plans.map(p => ({ ...p, prices: p.prices.map(({ amount, ...v }) => ({ ...v,
        amountMinor: v.priceType === "free" ? 0 : v.priceType === "fixed" || v.priceType === "from" ? parseAmountMinor(amount, v.currencyCode ?? null) : null })) }));
      const body = DraftSaveSchema.parse({ ...form, plans, expectedRevision: revision, reason });
      await run("PATCH", `/api/admin/aifind/products/${draft.identity.id}/draft/${draft.version.id}`, body, { success: "Draft を保存しました。Published は変わりません。" });
    } catch (err) { setError(`入力を確認してください: ${err instanceof Error ? err.message : String(err)}`); }
  }}>
    <div className="px-4"><p className="text-xs text-ink-3">revision {revision} · lastVerifiedAt: <At at={draft.lastVerifiedAt} /></p>
      <p className="mt-2 text-xs text-ink-3">明確な事実には根拠と確認日時が必要です。未確認 (unknown) のまま保存できます。</p></div>
    <Block title="Version / Lifecycle">
      <Field label="表示名"><Input aria-label="Draft display name" value={form.version.displayName ?? ""} required maxLength={200} onChange={e => setForm(f => ({ ...f, version: { ...f.version, displayName: e.target.value } }))} /></Field>
      <Field label="日本語の製品説明" hint="人が確認したプレーンテキスト。公開ページの説明と SEO に使用します。"><textarea aria-label="Draft Japanese summary" rows={4} maxLength={2000} className="w-full rounded-control border border-line bg-bg p-3" value={form.version.summaryJa??''} onChange={e=>setForm(f=>({...f,version:{...f.version,summaryJa:e.target.value||null}}))}/></Field>
      <Field label="公式 URL"><Input type="url" aria-label="Draft official URL" value={form.version.officialUrl ?? ""} onChange={e => setForm(f => ({ ...f, version: { ...f.version, officialUrl: e.target.value || null } }))} /></Field>
      <Choice label="Lifecycle" value={form.version.lifecycleStatus ?? "unknown"} options={LIFECYCLE_STATUSES} onChange={v => setForm(f => ({ ...f, version: { ...f.version, lifecycleStatus: v as typeof f.version.lifecycleStatus } }))} />
      {proof("Lifecycle", { evidenceId: form.version.lifecycleEvidenceId, verifiedAt: form.version.lifecycleVerifiedAt }, v => setForm(f => ({ ...f, version: { ...f.version, lifecycleEvidenceId: v.evidenceId, lifecycleVerifiedAt: v.verifiedAt } })))}
    </Block>
    <Block title="Market Availability">{form.markets.map((m, i) => <div key={m.marketCode}>
      <Choice label={`Market ${m.marketCode}`} value={m.availabilityStatus} options={["unknown", "available", "unavailable", "waitlist", "restricted"]} onChange={v => setForm(f => ({ ...f, markets: f.markets.map((m, j) => j === i ? { ...m, availabilityStatus: v as typeof m.availabilityStatus } : m) }))} />
      {proof(`Market ${m.marketCode}`, m, v => setForm(f => ({ ...f, markets: f.markets.map((m, j) => j === i ? { ...m, ...v } : m) })))}
    </div>)}</Block>
    <Block title="Japanese Support / 言語対応">{form.languages.map((l, i) => <div key={l.languageCode} className="rounded-control bg-bg-sunk p-3">
      <p className="mb-2 font-semibold">{l.languageCode}</p><div className="grid gap-2 sm:grid-cols-3">{(["input", "output", "ui"] as const).map(key => {
        const field = `${key}Support` as const; const label = l.languageCode === "ja" ? `Japanese ${key === "ui" ? "UI" : key === "input" ? "Input" : "Output"}` : `English ${key}`;
        return <Choice key={key} label={label} value={l[field]} options={SUPPORT_LEVELS} onChange={v => setForm(f => ({ ...f, languages: f.languages.map((l, j) => j === i ? { ...l, [field]: v } : l) }) as Form)} />;
      })}</div>{proof(`Language ${l.languageCode}`, l, v => setForm(f => ({ ...f, languages: f.languages.map((l, j) => j === i ? { ...l, ...v } : l) })))}</div>)}</Block>
    <Block title="Platforms">{PLATFORM_KEYS.map((key, i) => { const p = form.platforms[i]; return <div key={key}>
      <Choice label={`Platform ${key}`} value={p.status} options={["unknown", "available", "unavailable"]} onChange={v => setForm(f => ({ ...f, platforms: f.platforms.map((p, j) => i === j ? { ...p, status: v as typeof p.status } : p) }))} />
      {proof(`Platform ${key}`, p, v => setForm(f => ({ ...f, platforms: f.platforms.map((p, j) => i === j ? { ...p, ...v } : p) })))}
    </div>; })}</Block>
    <Block title="Capabilities">{CAPABILITY_KEYS.map((key, i) => { const p = form.capabilities[i]; return <div key={key}>
      <Choice label={`Capability ${key}`} value={p.supportLevel} options={SUPPORT_LEVELS} onChange={v => setForm(f => ({ ...f, capabilities: f.capabilities.map((p, j) => i === j ? { ...p, supportLevel: v as typeof p.supportLevel } : p) }))} />
      {proof(`Capability ${key}`, p, v => setForm(f => ({ ...f, capabilities: f.capabilities.map((p, j) => i === j ? { ...p, ...v } : p) })))}
    </div>; })}</Block>
    <Block title="Plans / Pricing">{form.plans.map((p, i) => <div key={i} className="space-y-3 rounded-control bg-bg-sunk p-3">
      <div className="grid gap-2 sm:grid-cols-2"><Field label="Plan key"><Input aria-label={`Plan key ${i + 1}`} readOnly={i < draft.plans.length} value={p.planKey} required onChange={e => changePlan(i, { planKey: e.target.value })} /></Field>
        <Field label="Plan 名"><Input aria-label={`Plan name ${i + 1}`} value={p.name} required onChange={e => changePlan(i, { name: e.target.value })} /></Field></div>
      <div className="grid gap-2 sm:grid-cols-3"><Choice label={`Audience ${p.planKey}`} value={p.audience ?? "unknown"} options={["unknown", "free", "personal", "team", "business", "enterprise", "developer"]} onChange={v => changePlan(i, { audience: v as EditablePlan["audience"] })} />
        <Choice label={`Billing model ${p.planKey}`} value={p.billingModel ?? "unknown"} options={["unknown", "free", "subscription", "usage", "custom"]} onChange={v => changePlan(i, { billingModel: v as EditablePlan["billingModel"] })} />
        <Choice label={`Plan status ${p.planKey}`} value={p.activeStatus ?? "unknown"} options={["unknown", "active", "inactive"]} onChange={v => changePlan(i, { activeStatus: v as EditablePlan["activeStatus"] })} /></div>
      {proof(`Plan ${p.planKey}`, p, v => changePlan(i, v))}
      {p.prices.map((v, j) => <div key={j} className="space-y-2 border-t border-line pt-3">
        <div className="grid gap-2 sm:grid-cols-2"><Choice label={`Price type ${p.planKey} ${j + 1}`} value={v.priceType} options={["unknown", "free", "fixed", "from", "custom"]} onChange={type => changePrice(i, j, { priceType: type as ProductPrice["priceType"], amount: type === "free" ? "0" : type === "unknown" || type === "custom" ? "" : v.amount })} />
          <Choice label={`Billing period ${p.planKey} ${j + 1}`} value={v.billingPeriod} options={["none", "month", "year", "usage", "one_time", "custom"]} optionLabels={{ none: "未設定" }} onChange={period => changePrice(i, j, { billingPeriod: period as ProductPrice["billingPeriod"] })} /></div>
        {(v.priceType === "fixed" || v.priceType === "from") && v.billingPeriod === "none" && <p className="text-xs text-hot">固定料金・最低料金には課金周期が必要です。</p>}
        <div className="grid gap-2 sm:grid-cols-2"><Choice label={`Currency ${p.planKey} ${j + 1}`} value={v.currencyCode ?? "unknown"} options={["unknown", ...CURRENCY_CODES]} onChange={currency => changePrice(i, j, { currencyCode: currency === "unknown" ? null : currency as ProductPrice["currencyCode"] })} />
          <Choice label={`Price market ${p.planKey} ${j + 1}`} value={v.marketCode ?? "unknown"} options={["unknown", ...MARKET_CODES]} onChange={market => changePrice(i, j, { marketCode: market === "unknown" ? null : market as ProductPrice["marketCode"] })} /></div>
        {(v.priceType === "fixed" || v.priceType === "from") && <Field label="金額（選択した通貨単位）" hint="JPY は整数、USD/EUR/GBP は小数 2 桁まで。">
          <Input aria-label={`Amount ${p.planKey} ${j + 1}`} inputMode="decimal" value={v.amount} required onChange={e => changePrice(i, j, { amount: e.target.value })} /></Field>}
        {v.priceType === "free" ? <p className="text-xs text-ok">無料 · amount = 0</p> : (v.priceType === "custom" || v.priceType === "unknown") && <p className="text-xs text-ink-3">{v.priceType === "custom" ? "個別見積もり" : "料金未確認"} · 金額は設定しません。</p>}
        <Field label="単位の補足"><Input aria-label={`Unit ${p.planKey} ${j + 1}`} value={v.unitLabel ?? ""} onChange={e => changePrice(i, j, { unitLabel: e.target.value || null })} /></Field>
        <div className="grid gap-2 sm:grid-cols-2"><Field label="有効開始日"><Input type="date" aria-label={`Valid from ${p.planKey} ${j + 1}`} value={v.validFrom ?? ""} onChange={e => changePrice(i, j, { validFrom: e.target.value || null })} /></Field>
          <Field label="有効終了日"><Input type="date" aria-label={`Valid to ${p.planKey} ${j + 1}`} value={v.validTo ?? ""} onChange={e => changePrice(i, j, { validTo: e.target.value || null })} /></Field></div>
        {proof(`Price ${p.planKey} ${j + 1}`, v, value => changePrice(i, j, value))}
      </div>)}
      <Button onClick={() => changePlan(i, { prices: [...p.prices, { priceType: "unknown", billingPeriod: "none", currencyCode: null, amount: "", ...unknownProof }] })}>価格を追加</Button>
    </div>)}<Button onClick={() => setForm(f => ({ ...f, plans: [...f.plans, { planKey: `new-plan-${f.plans.length + 1}`, name: "新しい Plan", prices: [], ...unknownProof }] }))}>Plan を追加</Button></Block>
    <div className="space-y-3 border-t border-line bg-amber/5 p-4"><ReasonField value={reason} onChange={setReason} />
      {error && <p role="alert" className="break-words text-xs text-hot">{error}</p>}
      <Button type="submit" tone="primary" busy={busy} disabled={!reason.trim()}>Draft を保存</Button>
    </div>
  </form>;
}
