import { useState } from "react";
import { useNavigate } from "react-router";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { Button, Field, Input, Select } from "../../../apps/web/app/features/admin/ui.tsx";
import { CandidateSchema, parseAmountMinor, formatAmountMinor, candidatePriceFromPublished } from "../admin/contracts.ts";
import type { Candidate, ProductAdminList, ProductAdminDetail, CandidateType } from "../admin/contracts.ts";
import { MARKET_CODES, LANGUAGE_CODES, PLATFORM_KEYS, CAPABILITY_KEYS, SUPPORT_LEVELS, LIFECYCLE_STATUSES, CURRENCY_CODES } from "../contracts.ts";
import type { Evidence, ProductPrice } from "../contracts.ts";
import { Choice, ProofFields, ReasonField } from "./admin-common.tsx";
import LookupSelect from "./lookup-select.tsx";

export default function CandidateEditor({ products, evidence }: { products: ProductAdminList; evidence: Evidence[] }) {
  const [product, setProduct] = useState<ProductAdminDetail | null>(null), [type, setType] = useState<CandidateType>("market"), [key, setKey] = useState("JP"), [ref, setRef] = useState("");
  const [proof, setProof] = useState({ evidenceId: null as string | null, verifiedAt: null as string | null }), [reason, setReason] = useState(""), [error, setError] = useState("");
  const [status, setStatus] = useState("unknown"), [input, setInput] = useState("unknown"), [output, setOutput] = useState("unknown"), [ui, setUi] = useState("unknown");
  const [planName, setPlanName] = useState("新しい Plan"), [audience, setAudience] = useState("unknown"), [billing, setBilling] = useState("unknown"), [planStatus, setPlanStatus] = useState("unknown");
  const [priceType, setPriceType] = useState("unknown"), [currency, setCurrency] = useState("unknown"), [amount, setAmount] = useState(""), [period, setPeriod] = useState("none");
  const [market, setMarket] = useState("unknown"), [unit, setUnit] = useState(""), [validFrom, setValidFrom] = useState(""), [validTo, setValidTo] = useState("");
  const { run, busy } = useAdminAction(), navigate = useNavigate();
  const options = type === "market" ? MARKET_CODES : type === "language" ? LANGUAGE_CODES : type === "platform" ? PLATFORM_KEYS : type === "capability" ? CAPABILITY_KEYS : null;
  const resetPrice = () => { setPriceType("unknown"); setCurrency("unknown"); setAmount(""); setPeriod("none"); setMarket("unknown"); setUnit(""); setValidFrom(""); setValidTo(""); };
  const choosePrice = (id: string) => {
    setRef(id); const price = product?.published?.plans.find(p => p.planKey === key)?.prices.find(p => p.id === id);
    if (!price) { resetPrice(); return; }
    const value = candidatePriceFromPublished(price);
    setPriceType(value.priceType); setCurrency(value.currencyCode ?? "unknown"); setPeriod(value.billingPeriod);
    setAmount(value.amountMinor == null ? "" : formatAmountMinor(value.amountMinor, value.currencyCode ?? null));
    setMarket(value.marketCode ?? "unknown"); setUnit(value.unitLabel ?? ""); setValidFrom(value.validFrom ?? ""); setValidTo(value.validTo ?? "");
    setProof({ evidenceId: value.evidenceId ?? null, verifiedAt: value.verifiedAt ?? null });
  };
  const chooseType = (v: string) => { setType(v as CandidateType); setStatus("unknown"); setRef(""); resetPrice(); setKey(v === "market" ? "JP" : v === "language" ? "ja" : v === "platform" ? "web" : v === "capability" ? "text" : v === "lifecycle" ? "lifecycle" : v === "price" ? product?.published?.plans[0]?.planKey ?? "" : "new-plan"); };
  return <details data-candidate-create><summary className="cursor-pointer text-sm font-semibold text-accent">手動の変更提案を作成</summary>
    <form className="mt-4 space-y-3" onSubmit={async e => {
      e.preventDefault(); setError("");
      try {
        if (!product?.published) throw new Error("Published のある製品を選択してください。");
        let proposedValue: Record<string, unknown>;
        switch (type) {
          case "market": proposedValue = { marketCode: key, availabilityStatus: status, ...proof }; break;
          case "language": proposedValue = { languageCode: key, inputSupport: input, outputSupport: output, uiSupport: ui, ...proof }; break;
          case "platform": proposedValue = { platformKey: key, status, ...proof }; break;
          case "capability": proposedValue = { capabilityKey: key, supportLevel: status, ...proof }; break;
          case "plan": proposedValue = { planKey: key, name: planName, audience, billingModel: billing, activeStatus: planStatus, ...proof }; break;
          case "price": proposedValue = { priceType, billingPeriod: period, currencyCode: currency === "unknown" ? null : currency,
            marketCode: market === "unknown" ? null : market, unitLabel: unit || null, validFrom: validFrom || null, validTo: validTo || null,
            amountMinor: priceType === "free" ? 0 : priceType === "fixed" || priceType === "from" ? parseAmountMinor(amount, currency === "unknown" ? null : currency as ProductPrice["currencyCode"]) : null, ...proof }; break;
          case "lifecycle": proposedValue = { lifecycleStatus: status, lifecycleEvidenceId: proof.evidenceId, lifecycleVerifiedAt: proof.verifiedAt }; break;
        }
        const body = CandidateSchema.parse({ productId: product.identity.id, baseVersionId: product.published.version.id, candidateType: type,
          targetKey: key, targetRef: type === "price" ? ref || null : null, proposedValue, evidenceId: proof.evidenceId, sourceType: "manual", reason });
        const result = await run<Candidate>("POST", "/api/admin/aifind/candidates", body, { success: "レビュー待ちの提案を作成しました。", revalidate: false });
        if (result) navigate(`/admin/aifind/review/${result.id}`);
      } catch (err) { setError(`入力を確認してください: ${err instanceof Error ? err.message : String(err)}`); }
    }}>
      <LookupSelect label="Candidate product" fieldLabel="Product" endpoint="/api/admin/aifind/products?filter=published" initialRows={products.rows} initialHasMore={products.hasMore}
        value={product?.identity.id ?? ""} describe={p => `${p.canonicalName} · Published v${p.publishedVersionNo}`} emptyLabel="製品を選択" onChange={async id => {
        setProduct(null); setError(""); setRef(""); resetPrice(); if (!id) return;
        try { const r = await fetch(`/api/admin/aifind/products/${encodeURIComponent(id)}`, { credentials: "same-origin" });
          if (!r.ok) throw new Error("製品の読み込みに失敗しました。再読み込みしてください。");
          const value = await r.json() as ProductAdminDetail; setProduct(value); if (type === "price") setKey(value.published?.plans[0]?.planKey ?? "");
        } catch (err) { setError(String(err)); }
      }} />
      <p className="text-xs text-ink-3">基準: {product?.published ? `Published v${product.published.version.versionNo} (${product.published.version.id})` : "未選択"} · source: manual</p>
      <Choice label="Candidate type" value={type} options={["market", "language", "platform", "capability", "plan", "price", "lifecycle"]} onChange={chooseType} />
      {options ? <Choice label="Target key" value={key} options={options} onChange={setKey} /> : type === "price" ? <Field label="対象 Plan"><Select aria-label="Candidate price plan" value={key} onChange={e => { setKey(e.target.value); setRef(""); resetPrice(); }}>
        <option value="">Plan を選択</option>{product?.published?.plans.map(p => <option key={p.planKey} value={p.planKey}>{p.planKey} · {p.name}</option>)}</Select></Field>
        : type === "plan" && <Field label="Plan key"><Input aria-label="Candidate plan key" value={key} required pattern="[a-z0-9]+(-[a-z0-9]+)*" onChange={e => setKey(e.target.value)} /></Field>}
      {type === "language" ? <div className="grid gap-3 sm:grid-cols-3"><Choice label="Proposed Input" value={input} options={SUPPORT_LEVELS} onChange={setInput} /><Choice label="Proposed Output" value={output} options={SUPPORT_LEVELS} onChange={setOutput} /><Choice label="Proposed UI" value={ui} options={SUPPORT_LEVELS} onChange={setUi} /></div>
        : ["market", "platform", "capability", "lifecycle"].includes(type) && <Choice label="Proposed state" value={status} options={type === "market" ? ["unknown", "available", "unavailable", "waitlist", "restricted"] : type === "platform" ? ["unknown", "available", "unavailable"] : type === "capability" ? SUPPORT_LEVELS : LIFECYCLE_STATUSES} onChange={setStatus} />}
      {type === "plan" && <><Field label="Plan 名"><Input aria-label="Candidate plan name" value={planName} required onChange={e => setPlanName(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-3"><Choice label="Proposed audience" value={audience} options={["unknown", "free", "personal", "team", "business", "enterprise", "developer"]} onChange={setAudience} />
          <Choice label="Proposed billing model" value={billing} options={["unknown", "free", "subscription", "usage", "custom"]} onChange={setBilling} /><Choice label="Proposed plan status" value={planStatus} options={["unknown", "active", "inactive"]} onChange={setPlanStatus} /></div></>}
      {type === "price" && <><Field label="変更する Price"><Select aria-label="Candidate price reference" value={ref} onChange={e => choosePrice(e.target.value)}><option value="">新しい価格を追加</option>
        {product?.published?.plans.find(p => p.planKey === key)?.prices.map(p => <option key={p.id} value={p.id}>{p.priceType} · {p.currencyCode ?? "未確認"} · {p.billingPeriod} · {p.id}</option>)}</Select></Field>
        <div className="grid gap-3 sm:grid-cols-3"><Choice label="Proposed price type" value={priceType} options={["unknown", "free", "fixed", "from", "custom"]} onChange={v => { setPriceType(v); if (["unknown", "custom"].includes(v)) setAmount(""); }} />
          <Choice label="Proposed currency" value={currency} options={["unknown", ...CURRENCY_CODES]} onChange={setCurrency} /><Choice label="Proposed billing period" value={period} options={["none", "month", "year", "usage", "one_time", "custom"]} optionLabels={{ none: "未設定" }} onChange={setPeriod} /></div>
        {(priceType === "fixed" || priceType === "from") && period === "none" && <p className="text-xs text-hot">固定料金・最低料金には課金周期が必要です。</p>}
        {(priceType === "fixed" || priceType === "from") ? <Field label="金額"><Input aria-label="Proposed amount" inputMode="decimal" value={amount} required onChange={e => setAmount(e.target.value)} /></Field> : <p className="text-xs text-ink-3">{priceType === "free" ? "無料 · amount = 0" : "金額は設定しません。"}</p>}
        <Choice label="Proposed price market" value={market} options={["unknown", ...MARKET_CODES]} onChange={setMarket} />
        <Field label="単位の補足"><Input aria-label="Proposed unit" value={unit} maxLength={200} onChange={e => setUnit(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="有効開始日"><Input aria-label="Proposed valid from" type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></Field>
          <Field label="有効終了日"><Input aria-label="Proposed valid to" type="date" value={validTo} onChange={e => setValidTo(e.target.value)} /></Field></div>
      </>}
      <ProofFields label="Candidate" evidence={[...new Map([...evidence, ...(product?.published?.evidence ?? [])].map(e => [e.id, e])).values()]} {...proof} onChange={setProof} /><ReasonField value={reason} onChange={setReason} />
      {error && <p role="alert" className="break-all text-xs text-hot">{error}</p>}
      <Button type="submit" busy={busy} disabled={!product?.published || !reason.trim()}>レビュー待ちとして登録</Button>
    </form>
  </details>;
}
