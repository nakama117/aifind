import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Badge, Button, ButtonLink, Card, ReasonDialog } from "../../../apps/web/app/features/admin/ui.tsx";
import type { CandidateDetail } from "../admin/contracts.ts";
import { AdminNav, adminHeaders, adminMeta, dialogCopy, labels, ValueRows } from "./admin-common.tsx";
import { At } from "./product-view.tsx";
export const meta = () => adminMeta("変更提案のレビュー");
export const headers = adminHeaders;
export const loader = ({ request, params }: { request: Request; params: { id?: string } }) => adminGet<CandidateDetail>(request, `/api/admin/aifind/candidates/${encodeURIComponent(params.id ?? "")}`);
export default function ReviewDetailPage() {
  const d = useLoaderData<typeof loader>(), c = d.candidate; const { run, busy } = useAdminAction(); const revalidator = useRevalidator();
  const [action, setAction] = useState<"approve" | "reject" | "apply" | null>(null);
  return <AdminPage title={`${d.productName} · 変更提案`} subtitle={`${c.candidateType} / ${c.targetKey}`} actions={<Button onClick={() => revalidator.revalidate()}>最新の内容を再読み込み</Button>}>
    <div lang="ja" className="space-y-5"><AdminNav /><div className="flex flex-wrap items-center gap-3"><Badge tone={c.status === "pending_review" ? "warn" : c.status === "applied" ? "ok" : "muted"}>{labels[c.status] ?? c.status} ({c.status})</Badge>
      <ButtonLink to={`/admin/aifind/products/${c.productId}`}>製品と Draft を開く</ButtonLink><span className="text-xs text-ink-3">source: {c.sourceType} · Created: <At at={c.createdAt} /></span></div>
      <Card title="基準バージョン"><p className="break-all text-xs text-ink-3">baseVersionId: {c.baseVersionId}<br />currentPublishedVersionId: {d.currentPublishedVersionId ?? "なし"}</p>
        {d.conflict && <p role="alert" className="mt-3 rounded-control bg-hot-soft p-3 text-sm text-hot">{d.conflict} 適用時にも検査し、競合は 409 として拒否します。</p>}</Card>
      {c.detector && <Card title="Detector · 自動検出、要人手確認"><div data-detector-provenance className="space-y-2 text-xs text-ink-3 break-all">
        <p>Observation: {c.detector.observationId} · method: {c.detector.resolverMethod}</p>
        <p>Resolver: {c.detector.resolverVersion} · Detector: {c.detector.detectorVersion} · Prompt: {c.detector.promptVersion}</p>
        <p>Receipt: resolver {c.detector.resolverReceiptId ?? 'なし'} / detector {c.detector.detectorReceiptId ?? 'なし'}</p>
        <p>Proposal key: {c.detector.proposalKey}</p><p>取得と検出は確認ではありません。承認後、Draft への適用時に人による確認日時を記録します。</p>
      </div></Card>}
      <div className="grid items-start gap-4 md:grid-cols-2"><Card title="Current · 現在の公開版"><div data-current-value><ValueRows value={d.currentValue} /></div></Card>
        <Card title="Proposed · 提案された変更"><div data-proposed-value><ValueRows value={c.proposedValue} /></div></Card></div>
      <details className="text-sm"><summary className="cursor-pointer text-accent">基準時点 / 現在の Draft を確認</summary><div className="mt-3 grid gap-4 md:grid-cols-2"><Card title="Base"><ValueRows value={d.baseValue} /></Card><Card title="Draft"><ValueRows value={d.draftValue} /></Card></div></details>
      <Card title="Evidence"><h3 className="text-sm font-semibold">{d.evidence.title ?? "根拠"}</h3><p className="mt-1 text-xs text-ink-3">{d.evidence.sourceKind} · {d.evidence.publisher ?? "Publisher 未設定"}</p>
        <a className="mt-2 block break-all text-sm text-accent underline" href={d.evidence.url} target="_blank" rel="noopener noreferrer">{d.evidence.url}</a>
        {d.detectorEvidence && <div className="mt-3"><p className="text-xs text-ink-3">必要な短い引用と前後の文脈（各最大160文字）。元の本文は retention policy により削減される場合があります。</p><pre data-evidence-context className="mt-2 whitespace-pre-wrap break-all text-xs">{d.detectorEvidence.contextBefore}</pre><pre data-detector-quote className="overflow-x-auto whitespace-pre-wrap break-all rounded-control bg-bg-sunk p-3 text-xs">{d.detectorEvidence.quote}</pre><pre className="whitespace-pre-wrap break-all text-xs">{d.detectorEvidence.contextAfter}</pre>
          <p className="mt-1 text-xs text-ink-3">資料の文字位置: {d.detectorEvidence.start}–{d.detectorEvidence.end} · content hash: {d.evidence.contentHash}</p></div>}
        <p className="mt-3 text-xs">提案の verifiedAt: <At at={(c.proposedValue.verifiedAt ?? c.proposedValue.lifecycleVerifiedAt ?? null) as string | null} /></p>
        <p className="mt-1 text-xs text-ink-3">retrievedAt: <At at={d.evidence.retrievedAt} /></p><p className="mt-2 text-xs text-ink-3">{d.evidence.evidenceNote}</p></Card>
      <Card title={`Supporting Evidence · ${d.supportingEvidence.length}件`}><p className="mb-3 text-xs text-ink-3">同じ意味の提案をまとめています。根拠の数は承認や信頼度を自動的に上げません。</p><div data-supporting-evidence className="space-y-4">{d.supportingEvidence.map(s=><section key={s.evidence.id} className="rounded-control border border-line p-3 text-xs break-all"><p>{s.primary?'Primary · 最初の根拠':'Supporting · 追加の根拠'} · {s.evidence.sourceKind} · {s.evidence.publisher}</p><a href={s.evidence.url} className="text-accent underline" target="_blank" rel="noopener noreferrer">{s.evidence.url}</a><p>retrievedAt: <At at={s.evidence.retrievedAt}/></p><p>contentHash: {s.evidence.contentHash}</p>{s.context&&<pre className="mt-2 whitespace-pre-wrap">{s.context.contextBefore}{s.context.quote}{s.context.contextAfter}</pre>}</section>)}</div></Card>
      <Card title="Review / Apply"><p className="mb-4 text-sm">承認は公開を意味しません。適用は Draft だけを変更します。公開には製品ページで別途確認が必要です。</p>
        <div className="flex flex-wrap gap-2">{c.status === "pending_review" && <><Button tone="primary" onClick={() => setAction("approve")}>承認</Button><Button tone="danger" onClick={() => setAction("reject")}>拒否</Button></>}
          {c.status === "approved" && <Button tone="primary" onClick={() => setAction("apply")}>Draft に適用</Button>}
          {c.status === "applied" && <Button onClick={() => setAction("apply")}>適用結果を再確認</Button>}</div>
        {c.reviewedAt && <p className="mt-4 text-xs text-ink-3">Reviewed: <At at={c.reviewedAt} /> · {c.reviewedBy} · {c.reviewReason}</p>}
        {c.appliedAt && <p className="mt-2 break-all text-xs text-ink-3">Applied: <At at={c.appliedAt} /> · version {c.appliedVersionId}</p>}
      </Card>
    </div>
    <ReasonDialog open={action !== null} title={action === "approve" ? "この提案を承認しますか？" : action === "reject" ? "この提案を拒否しますか？" : "提案を Draft に適用しますか？"}
      description={action === "apply" ? "基準 Published と Draft の対象値を再検証します。適用済みの提案は二重に保存されません。公開版は変更しません。" : "操作理由は既存の監査記録に保存します。"}
      copy={dialogCopy} confirmLabel={action === "approve" ? "承認を確定" : action === "reject" ? "拒否を確定" : "適用を確定"} danger={action === "reject"} busy={busy} onClose={() => setAction(null)}
      onSubmit={async reason => (await run("POST", `/api/admin/aifind/candidates/${c.id}/${action}`, { reason }, { success: action === "apply" ? "適用結果を確認しました。Published は変わりません。" : "レビューを記録しました。" })) !== null} />
  </AdminPage>;
}
