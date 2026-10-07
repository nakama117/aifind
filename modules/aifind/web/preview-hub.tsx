import { useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import { adminGet } from "@aihot/web/lib/admin.server";
import { AdminPage, Badge, ButtonLink, Card } from "../../../apps/web/app/features/admin/ui.tsx";
import type { PreviewHub } from "../preview/contracts.ts";

export const meta = () => [{ title: `Phase Preview · ${SITE.name}` }, { name: "robots", content: "noindex, nofollow" }];
export const headers = () => ({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
export async function loader({ request }: { request: Request }) {
  return adminGet<PreviewHub>(request, "/api/admin/aifind/preview");
}
export default function PreviewHubPage() {
  const { previews } = useLoaderData<typeof loader>();
  return <AdminPage title="Phase Preview" subtitle="各 Phase の成果を確認する、管理者専用のプレビューです。">
    <div className="space-y-4">{previews.map(preview => <Card key={preview.path} title={preview.title} right={<Badge tone="ok">{preview.status}</Badge>}>
      <p className="mb-4 text-sm text-ink-3">実際の Domain Reader で、公開版と下書きの違いを確認できます。</p>
      {preview.status==='Available'?<ButtonLink to={preview.path}>プレビューを開く</ButtonLink>:<p className="text-sm text-ink-3">合成データ用の Preview 開始フラグが無効です。成果とコードは保持されています。</p>}
    </Card>)}</div>
  </AdminPage>;
}
