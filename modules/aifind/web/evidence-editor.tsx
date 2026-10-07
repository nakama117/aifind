import { useState } from "react";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { Button, Card, Field, Input, Textarea } from "../../../apps/web/app/features/admin/ui.tsx";
import { SOURCE_KINDS } from "../contracts.ts";
import type { Evidence } from "../contracts.ts";
import { Choice, ReasonField } from "./admin-common.tsx";
import { At } from "./product-view.tsx";

export default function EvidenceEditor({ evidence }: { evidence: Evidence[] }) {
  const [url, setUrl] = useState(""), [title, setTitle] = useState(""), [publisher, setPublisher] = useState("");
  const [sourceKind, setSourceKind] = useState("official_product"), [retrievedAt, setRetrievedAt] = useState(""), [publishedAt, setPublishedAt] = useState("");
  const [note, setNote] = useState(""), [reason, setReason] = useState("");
  const { run, busy } = useAdminAction();
  return <Card title="Evidence · 根拠の管理">
    <p className="text-xs leading-relaxed text-ink-3">URL と出典を手動で記録します。根拠の訂正は新しい記録を追加し、Draft の参照を変更してください。公開版の根拠は保存されます。</p>
    <details className="mt-4" data-evidence-create><summary className="cursor-pointer text-sm font-medium text-accent">Evidence を追加</summary>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async e => {
        e.preventDefault(); const result = await run<Evidence>("POST", "/api/admin/aifind/evidence", { url, title: title || null, publisher: publisher || null, sourceKind, retrievedAt,
          publishedAt: publishedAt || null, evidenceNote: note || null, reason }, { success: "Evidence を追加しました。Draft の対象フィールドで選択してください。" });
        if (result) { setUrl(""); setTitle(""); setNote(""); }
      }}>
        <Field label="Evidence URL"><Input aria-label="Evidence URL" type="url" required value={url} onChange={e => setUrl(e.target.value)} /></Field>
        <Choice label="Source kind" value={sourceKind} options={SOURCE_KINDS} onChange={setSourceKind} />
        <Field label="Title"><Input aria-label="Evidence title" value={title} maxLength={500} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Publisher"><Input aria-label="Evidence publisher" value={publisher} maxLength={200} onChange={e => setPublisher(e.target.value)} /></Field>
        <Field label="Retrieved at（timezone 必須）"><Input aria-label="Evidence retrieved at" required value={retrievedAt} onChange={e => setRetrievedAt(e.target.value)} /><Button size="sm" onClick={() => setRetrievedAt(new Date().toISOString())}>現在の時刻を入力</Button></Field>
        <Field label="Published at（任意 / timezone 必須）"><Input aria-label="Evidence published at" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Evidence note"><Textarea aria-label="Evidence note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><ReasonField value={reason} onChange={setReason} /></div>
        <Button type="submit" busy={busy} disabled={!reason.trim()}>根拠を登録</Button>
      </form>
    </details>
    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-accent">登録済み Evidence ({evidence.length})</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{evidence.map(e => <article key={e.id} className="min-w-0 rounded-control bg-bg-sunk p-3 text-xs" data-evidence-id={e.id}>
        <h3 className="font-semibold">{e.title ?? "根拠"}</h3><p className="mt-1 text-ink-3">{e.sourceKind} · {e.publisher ?? "Publisher 未設定"}</p>
        <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-accent underline">{e.url}</a>
        <p className="mt-2">retrievedAt: <At at={e.retrievedAt} /></p><p className="mt-1">publishedAt: <At at={e.publishedAt} /></p>
        {e.evidenceNote && <p className="mt-2 text-ink-3">{e.evidenceNote}</p>}
      </article>)}</div>
    </details>
  </Card>;
}
