import { useRef, useState } from "react";
import { Button, Field, Input, Select } from "../../../apps/web/app/features/admin/ui.tsx";
import type { AdminLookup } from "../admin/contracts.ts";

/** Bounded admin-only HTTP lookup; the selected record survives searches and page changes. */
export default function LookupSelect<T extends { id: string }>({ label, fieldLabel = label, endpoint, initialRows, initialHasMore = initialRows.length >= 50,
  value, onChange, describe, emptyLabel = "未選択" }: { label: string; fieldLabel?: string; endpoint: string; initialRows: T[]; initialHasMore?: boolean;
  value: string; onChange: (value: string) => void; describe: (row: T) => string; emptyLabel?: string }) {
  const [result, setResult] = useState<AdminLookup<T> | null>(null), [selected, setSelected] = useState<T | null>(null);
  const [query, setQuery] = useState(""), [activeQuery, setActiveQuery] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  const rows = result?.rows ?? initialRows;
  const retained = [selected, ...initialRows].find(row => row?.id === value);
  const options = [...new Map([...rows, ...(retained ? [retained] : [])].map(row => [row.id, row])).values()];
  async function load(q: string, page: number) {
    const current = ++sequence.current; setBusy(true); setError("");
    try {
      const url = new URL(endpoint, window.location.origin); url.searchParams.set("q", q); url.searchParams.set("page", String(page));
      const response = await fetch(url.pathname + url.search, { credentials: "same-origin" });
      if (!response.ok) throw new Error("選択肢を取得できませんでした。再読み込みしてください。");
      const data = await response.json() as AdminLookup<T>;
      if (sequence.current === current) { setResult(data); setActiveQuery(q); }
    } catch (err) { if (sequence.current === current) setError(err instanceof Error ? err.message : String(err)); }
    finally { if (sequence.current === current) setBusy(false); }
  }
  return <div className="min-w-0">
    <Field label={fieldLabel}><Select aria-label={label} value={value} onChange={e => {
      setSelected(options.find(row => row.id === e.target.value) ?? null); onChange(e.target.value);
    }}><option value="">{emptyLabel}</option>{options.map(row => <option key={row.id} value={row.id}>{describe(row)}</option>)}</Select></Field>
    <details className="mt-1 text-xs" data-lookup-search={label}><summary className="cursor-pointer text-accent">選択肢を検索 / ページを移動</summary>
      <div className="mt-2 space-y-2"><div className="flex gap-2"><Input aria-label={`${label} search`} value={query} maxLength={100} placeholder="名前・URL など" onChange={e => setQuery(e.target.value)} />
        <Button size="sm" busy={busy} onClick={() => load(query, 1)}>検索</Button></div>
        <div className="flex items-center gap-3"><Button size="sm" disabled={busy || (result?.page ?? 1) === 1} onClick={() => load(activeQuery, (result?.page ?? 1) - 1)}>前へ</Button>
          <span>{result?.page ?? 1} ページ</span><Button size="sm" disabled={busy || !(result?.hasMore ?? initialHasMore)} onClick={() => load(activeQuery, (result?.page ?? 1) + 1)}>次へ</Button></div>
        {error && <p role="alert" className="text-hot">{error}</p>}
      </div>
    </details>
  </div>;
}
