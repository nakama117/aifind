import { Snapshot } from "./product-view.tsx";
import { useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Button, ButtonLink } from "../../../apps/web/app/features/admin/ui.tsx";
import type { ProductDomainPreview } from "../preview/contracts.ts";

export const meta = () => [{ title: `Product Domain Preview · ${SITE.name}` }, { name: "robots", content: "noindex, nofollow" }];
export const headers = () => ({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
export async function loader({ request }: { request: Request }) {
  return adminGet<ProductDomainPreview>(request, "/api/admin/aifind/preview/product-domain");
}

export default function ProductPreviewPage() {
  const { published, draft, canMutateDemo } = useLoaderData<typeof loader>();
  const { run, busy } = useAdminAction();
  return <AdminPage title="Product Domain Preview" subtitle="Phase 1 · 実際の Domain Reader で公開版と下書きを比較します。" actions={<ButtonLink to="/admin/aifind/preview">Preview Hub</ButtonLink>}>
    <div lang="ja" className="space-y-5">
      <div className="rounded-panel bg-accent-soft p-4 text-sm leading-relaxed text-ink">
        <p className="font-semibold">[PREVIEW] すべて合成データです。実在する製品の情報・料金ではありません。</p>
        <p className="mt-1 text-ink-3">左は公開版、右は下書きです。下書きの変更は公開版を変更しません。未確認（unknown）は利用不可や無料を意味しません。</p>
        {canMutateDemo && <div className="mt-3 flex flex-wrap items-center gap-3"><Button busy={busy} onClick={() => run("POST", "/api/admin/aifind/preview/product-domain/draft-demo", {}, { success: "下書きだけを変更しました。公開版は変わりません。" })}>Draft の名前だけを変更</Button><span className="text-xs text-ink-3">ローカルのデモ製品だけを変更します。</span></div>}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2"><Snapshot kind="published" product={published} /><Snapshot kind="draft" product={draft} /></div>
    </div>
  </AdminPage>;
}
