import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Badge, Button, Card, DataTable, ReasonDialog } from "../../../apps/web/app/features/admin/ui.tsx";
import type { ProductAdminDetail } from "../admin/contracts.ts";
import { AdminNav, adminHeaders, adminMeta, dialogCopy, DraftDiff } from "./admin-common.tsx";
import { At, Snapshot } from "./product-view.tsx";
import DraftEditor from "./draft-editor.tsx";
import IdentityEditor from "./identity-editor.tsx";
import EvidenceEditor from "./evidence-editor.tsx";
import PublicSettingsEditor from "./public-settings.tsx";
export const meta = () => adminMeta("製品の管理");
export const headers = adminHeaders;
export const loader = ({ request, params }: { request: Request; params: { id?: string } }) => adminGet<ProductAdminDetail>(request, `/api/admin/aifind/products/${encodeURIComponent(params.id ?? "")}`);
export default function ProductDetailPage() {
  const d = useLoaderData<typeof loader>(); const { run, busy } = useAdminAction(); const revalidator = useRevalidator();
  const [dialog, setDialog] = useState<"create" | "publish" | null>(null);
  return <AdminPage title={d.identity.canonicalName} subtitle={d.vendor?.name ?? "Vendor 未設定"} actions={<Button onClick={() => revalidator.revalidate()}>最新の内容を再読み込み</Button>}>
    <div lang="ja" className="space-y-5"><AdminNav />
      {d.identity.canonicalName.startsWith("[PREVIEW]") && <div className="rounded-panel bg-accent-soft p-3 text-sm font-medium">[PREVIEW] 合成データです。実在する製品の情報・料金ではありません。</div>}
      <div data-version-summary className="flex flex-wrap gap-3"><Badge tone="ok">Published {d.published ? `v${d.published.version.versionNo}` : "なし"}</Badge>
        <Badge tone="warn">Draft {d.draft ? `v${d.draft.version.versionNo}` : "なし"}</Badge><span className="text-xs text-ink-3">公開版の Last Verified: <At at={d.published?.lastVerifiedAt ?? null} /></span>
        {d.draft && <a href="#draft-editor" className="text-sm text-accent underline">Draft を編集</a>}</div>
      <IdentityEditor key={d.identityRevision} detail={d} />
      <PublicSettingsEditor key={`public:${d.identityRevision}`} detail={d}/>
      <EvidenceEditor evidence={d.evidence} />
      <div className="grid items-start gap-5 xl:grid-cols-2"><Snapshot product={d.published} kind="published" />
        <section id="draft-editor" data-version-status="draft" className="min-w-0 rounded-panel bg-surface ring-1 ring-line">
          <header className="mb-4 border-b border-line bg-amber/10 p-4"><h2 className="text-lg font-semibold">Draft · 下書き {d.draft && `v${d.draft.version.versionNo}`}</h2>
            <p className="mt-1 break-words text-xs text-ink-3">{d.draft ? `${d.draft.version.displayName} · 公開版には反映されません。` : "Draft はありません。"}</p></header>
          {d.draft ? <><DraftEditor key={`${d.draft.version.id}:${d.draftRevision}`} draft={d.draft} revision={d.draftRevision!} evidence={d.evidence} />
            <details className="p-4"><summary className="cursor-pointer text-sm text-accent">保存済み Draft を読む</summary><div className="mt-3"><Snapshot product={d.draft} kind="draft" mark={false} /></div></details></>
            : <div className="p-4"><Button onClick={() => setDialog("create")}>{d.published ? "Published から Draft を作成" : "初期 Draft を作成"}</Button></div>}
        </section></div>
      {d.draft && <Card title="Published → Draft の差分"><DraftDiff published={d.published} draft={d.draft} /></Card>}
      <Card title="バージョン履歴"><DataTable rows={d.history} rowKey={v => v.id} empty="バージョンがありません。" columns={[
        { key: "version", label: "Version", render: v => `v${v.versionNo}` }, { key: "status", label: "Status", render: v => <Badge tone={v.status === "published" ? "ok" : v.status === "draft" ? "warn" : "muted"}>{v.status}</Badge> },
        { key: "name", label: "表示名", render: v => v.displayName }, { key: "published", label: "Published at", render: v => <At at={v.publishedAt} /> }, { key: "superseded", label: "Superseded at", render: v => <At at={v.supersededAt} /> },
      ]} /></Card>
      {d.draft && <section data-publish-zone className="rounded-panel border border-hot/40 bg-hot-soft p-5"><h2 className="text-base font-semibold text-hot">Publish · 公開版の切り替え</h2>
        <p className="mt-2 text-sm">保存済み Draft v{d.draft.version.versionNo} を公開します。現在の公開版は履歴 (superseded) になります。</p>
        {d.publishIssues.length > 0 ? <div role="alert" className="mt-3 rounded-control bg-surface p-3 text-xs text-hot"><p className="mb-2 font-semibold">次の事実はまだ公開できません：</p>
          <ul className="space-y-1">{d.publishIssues.map(i => <li key={`${i.field}:${i.problem}`}>{i.field}: {i.problem === "evidence" ? "Evidence が必要です" : i.problem === "billingPeriod" ? "課金周期が必要です" : "verifiedAt が必要です"}</li>)}</ul></div>
          : <p className="mt-3 text-xs text-ok">根拠と確認日時の検証を通過しています。公開時にも再検証します。</p>}
        <Button className="mt-4" tone="danger" onClick={() => setDialog("publish")}>バージョンを公開</Button>
      </section>}
    </div>
    <ReasonDialog open={dialog !== null} title={dialog === "publish" ? "保存済み Draft を公開しますか？" : "Draft を作成しますか？"} copy={dialogCopy}
      description={dialog === "publish" ? "未保存の入力は含まれません。根拠・確認日時・最新 revision を再検証してから公開します。" : "現在の Published を複製します。公開版は変更されません。"}
      confirmLabel={dialog === "publish" ? "公開を確定" : "Draft を作成"} danger={dialog === "publish"} busy={busy} onClose={() => setDialog(null)}
      onSubmit={async reason => { const path = `/api/admin/aifind/products/${d.identity.id}/draft`;
        const result = await run("POST", dialog === "publish" ? `${path}/${d.draft!.version.id}/publish` : path,
          { reason, ...(dialog === "publish" ? { expectedRevision: d.draftRevision } : {}) }, { success: dialog === "publish" ? "公開しました。バージョン履歴を確認してください。" : "Draft を作成しました。" });
        return result !== null;
      }} />
  </AdminPage>;
}
