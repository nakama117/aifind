import type { ReactNode } from "react";
import { SITE } from "@aihot/site";
import { ButtonLink, Field, Input, Select } from "../../../apps/web/app/features/admin/ui.tsx";
import { State, At } from "./product-view.tsx";
import type { Evidence, ProductSnapshot } from "../contracts.ts";
import LookupSelect from "./lookup-select.tsx";

export const adminHeaders = () => ({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
export const adminMeta = (title: string) => [{ title: `${title} · ${SITE.name}` }, { name: "robots", content: "noindex, nofollow" }];
export const dialogCopy = { reasonLabel: "操作理由（監査記録）", optionalLabel: "備考", placeholder: "この操作を行う理由", cancelLabel: "キャンセル" };
export function AdminNav() {
  return <nav aria-label="AIFIND 管理" className="mb-5 flex flex-wrap gap-2">
    <ButtonLink to="/admin/aifind">概要</ButtonLink><ButtonLink to="/admin/aifind/products">製品一覧</ButtonLink>
    <ButtonLink to="/admin/aifind/review">レビュー待ち</ButtonLink><ButtonLink to="/admin/aifind/preview">Preview Hub</ButtonLink>
    <ButtonLink to="/admin/aifind/monitors">Source Monitor</ButtonLink>
    <ButtonLink to="/admin/aifind/compare">比較の管理</ButtonLink><ButtonLink to="/admin/aifind/categories">用途ページの管理</ButtonLink>
    <ButtonLink to="/admin/aifind/howto">使い方の管理</ButtonLink>
  </nav>;
}
export const labels: Record<string, string> = { unknown: "未確認", available: "利用可能", unavailable: "利用不可", none: "非対応", partial: "一部対応", full: "対応",
  restricted: "条件付き", waitlist: "順番待ち", active: "提供中", inactive: "停止中", beta: "ベータ", discontinued: "提供終了", acquired: "買収済み",
  free: "無料", fixed: "固定料金", from: "最低料金〜", custom: "個別見積もり", month: "月", year: "年", usage: "従量", one_time: "一回", subscription: "定額",
  pending_review: "レビュー待ち", approved: "承認済み・適用待ち", rejected: "拒否済み", applied: "Draft 適用済み" };
export function Choice({ label, value, options, onChange, optionLabels = {} }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; optionLabels?: Record<string, string> }) {
  return <Field label={label}><Select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
    {options.map(v => <option key={v} value={v}>{optionLabels[v] || labels[v] ? `${optionLabels[v] ?? labels[v]} (${v})` : v}</option>)}
  </Select></Field>;
}
export function ProofFields({ label, evidenceId, verifiedAt, evidence, onChange }: { label: string; evidenceId: string | null; verifiedAt: string | null;
  evidence: Evidence[]; onChange: (value: { evidenceId: string | null; verifiedAt: string | null }) => void }) {
  return <div className="mt-2 grid gap-2 sm:grid-cols-2">
    <LookupSelect label={`Evidence ${label}`} fieldLabel={`Evidence · ${label}`} endpoint="/api/admin/aifind/evidence" initialRows={evidence}
      value={evidenceId ?? ""} onChange={value => onChange({ evidenceId: value || null, verifiedAt })} describe={e => `${e.title ?? e.url} · ${e.sourceKind}`} />
    <Field label={`verifiedAt · ${label}`} hint="タイムゾーン付き日時（例 2026-10-06T09:00:00+09:00）">
      <Input aria-label={`Verified at ${label}`} value={verifiedAt ?? ""} placeholder="2026-10-06T09:00:00+09:00" onChange={e => onChange({ evidenceId, verifiedAt: e.target.value || null })} />
    </Field>
  </div>;
}
export function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Field label="保存理由（監査記録）"><Input aria-label="保存理由" value={value} onChange={e => onChange(e.target.value)} required maxLength={500} /></Field>;
}
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="min-w-0 space-y-3 border-t border-line px-4 py-4"><legend className="px-1 text-sm font-semibold text-ink">{title}</legend>{children}</fieldset>;
}
function Value({ value }: { value: unknown }) {
  if (value == null) return <span className="text-ink-3">未確認 / 未設定</span>;
  if (typeof value === "string" && labels[value]) return <State value={value} />;
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return <At at={value} />;
  return <span className="break-all">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>;
}
export function ValueRows({ value }: { value: Record<string, unknown> | null }) {
  if (!value) return <p className="text-sm text-ink-3">対象なし</p>;
  return <dl className="space-y-2 text-xs">{Object.entries(value).map(([key, v]) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3"><dt className="break-all text-ink-3">{key}</dt><dd><Value value={v} /></dd></div>)}</dl>;
}
function facts(p: ProductSnapshot | null) {
  const result = new Map<string, Record<string, unknown>>();
  if (!p) return result;
  const strip = (v: object) => Object.fromEntries(Object.entries(v).filter(([key]) => !["id", "productVersionId", "planId", "prices"].includes(key)));
  result.set("version", { displayName: p.version.displayName, officialUrl: p.version.officialUrl, summaryJa: p.version.summaryJa, lifecycleStatus: p.version.lifecycleStatus,
    lifecycleEvidenceId: p.version.lifecycleEvidenceId, lifecycleVerifiedAt: p.version.lifecycleVerifiedAt });
  for (const m of p.markets) result.set(`market:${m.marketCode}`, strip(m));
  for (const l of p.languages) result.set(`language:${l.languageCode}`, strip(l));
  for (const v of p.platforms) result.set(`platform:${v.platformKey}`, strip(v));
  for (const v of p.capabilities) result.set(`capability:${v.capabilityKey}`, strip(v));
  for (const v of p.plans) result.set(`plan:${v.planKey}`, { ...strip(v), prices: v.prices.map(strip).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) });
  return result;
}
export function DraftDiff({ published, draft }: { published: ProductSnapshot | null; draft: ProductSnapshot | null }) {
  const before = facts(published), after = facts(draft);
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(key => JSON.stringify(before.get(key)) !== JSON.stringify(after.get(key)));
  return <div data-draft-diff className="space-y-4">{changed.length ? changed.map(key => <div key={key} className="rounded-control bg-bg-sunk p-3">
    <h3 className="mb-3 text-sm font-semibold">{key}</h3><div className="grid gap-4 md:grid-cols-2"><div><h4 className="mb-2 text-xs text-ok">Published</h4><ValueRows value={before.get(key) ?? null} /></div>
      <div><h4 className="mb-2 text-xs text-amber">Draft</h4><ValueRows value={after.get(key) ?? null} /></div></div>
  </div>) : <p className="text-sm text-ink-3">保存済みの事実に差分はありません。</p>}</div>;
}
