import { useLoaderData } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { AdminPage, Card, Stat } from "../../../apps/web/app/features/admin/ui.tsx";
import type { Dashboard } from "../admin/contracts.ts";
import { AdminNav, adminHeaders, adminMeta } from "./admin-common.tsx";
export const meta = () => adminMeta("AIFIND 管理");
export const headers = adminHeaders;
export const loader = ({ request }: { request: Request }) => adminGet<Dashboard>(request, "/api/admin/aifind/dashboard");
export default function DashboardPage() {
  const d = useLoaderData<typeof loader>();
  return <AdminPage title="AIFIND 管理" subtitle="製品の下書き、根拠、レビュー待ちを確認します。"><div lang="ja" className="space-y-5"><AdminNav />
    <Card title="Products"><div className="grid gap-3 sm:grid-cols-4"><Stat label="総製品数" value={d.products.total} /><Stat label="Published" value={d.products.published} tone="ok" />
      <Stat label="Draft" value={d.products.draft} tone="warn" /><Stat label="公開版なし" value={d.products.noPublished} /></div></Card>
    <Card title="Review Queue"><div className="grid gap-3 sm:grid-cols-4"><Stat label="レビュー待ち" value={d.review.pending} tone="warn" /><Stat label="承認済み・適用待ち" value={d.review.approved} />
      <Stat label="拒否済み" value={d.review.rejected} /><Stat label="Draft 適用済み" value={d.review.applied} tone="ok" /></div></Card>
    <Card title="Data Health"><div className="grid gap-3 sm:grid-cols-3"><Stat label="Evidence がない明確な Draft 事実" value={d.dataHealth.factsMissingEvidence} tone="warn" />
      <Stat label="確認日時がない Draft 事実" value={d.dataHealth.factsMissingVerifiedAt} tone="warn" /><Stat label="Vendor 未設定" value={d.dataHealth.productsWithoutVendor} /></div></Card>
  </div></AdminPage>;
}
