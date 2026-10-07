import { useState } from "react";
import { Form, Link, useLoaderData, useNavigate, useSearchParams } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Badge, Button, Card, DataTable, Field, Input, Select } from "../../../apps/web/app/features/admin/ui.tsx";
import type { ProductAdminList, AdminLookup } from "../admin/contracts.ts";
import type { ProductIdentity, Vendor } from "../contracts.ts";
import { AdminNav, adminHeaders, adminMeta, ReasonField } from "./admin-common.tsx";
import { At, State } from "./product-view.tsx";
import LookupSelect from "./lookup-select.tsx";
export const meta = () => adminMeta("製品一覧");
export const headers = adminHeaders;
export async function loader({ request }: { request: Request }) {
  const sp = new URL(request.url).searchParams;
  const query = new URLSearchParams({ q: sp.get("q") ?? "", filter: sp.get("filter") ?? "all", page: sp.get("page") ?? "1" });
  const [list, vendors] = await Promise.all([adminGet<ProductAdminList>(request, `/api/admin/aifind/products?${query}`), adminGet<AdminLookup<Vendor>>(request, "/api/admin/aifind/vendors")]);
  return { ...list, vendors };
}
export default function ProductsPage() {
  const { rows, page, hasMore, vendors } = useLoaderData<typeof loader>(), [sp] = useSearchParams();
  const [name, setName] = useState(""), [slug, setSlug] = useState(""), [vendor, setVendor] = useState(""), [reason, setReason] = useState("");
  const { run, busy } = useAdminAction(); const navigate = useNavigate();
  const pageLink = (next: number) => { const copy = new URLSearchParams(sp); copy.set("page", String(next)); return `?${copy}`; };
  return <AdminPage title="製品一覧" subtitle="公開版と下書きを分けて管理します。"><div lang="ja" className="space-y-5"><AdminNav />
    <Form method="get" className="flex flex-wrap items-end gap-3"><Field label="製品名で検索"><Input aria-label="製品名で検索" name="q" defaultValue={sp.get("q") ?? ""} maxLength={100} /></Field>
      <Field label="状態で絞り込み"><Select aria-label="製品フィルター" name="filter" defaultValue={sp.get("filter") ?? "all"}>{[["all", "すべて"], ["published", "Published"], ["draft", "Draft"], ["needs_review", "レビュー待ち"], ["no_published", "公開版なし"]].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</Select></Field><Button type="submit">検索</Button></Form>
    <Card pad={false}><DataTable rows={rows} rowKey={p => p.id} empty="製品がありません。" columns={[
      { key: "name", label: "Product", render: p => <Link className="font-medium text-accent underline" to={`/admin/aifind/products/${p.id}`}>{p.canonicalName}</Link> },
      { key: "vendor", label: "Vendor", render: p => p.vendorName ?? "未設定" }, { key: "slug", label: "Slug", render: p => <span className="break-all text-xs">{p.slug}</span> },
      { key: "versions", label: "バージョン", render: p => <div className="space-y-1"><div>Published {p.publishedVersionNo ? `v${p.publishedVersionNo}` : "なし"}</div><div>Draft {p.draftVersionNo ? `v${p.draftVersionNo}` : "なし"}</div></div> },
      { key: "lifecycle", label: "Lifecycle", render: p => <State value={p.lifecycleStatus} /> }, { key: "verified", label: "Last Verified", render: p => <At at={p.lastVerifiedAt} /> },
      { key: "status", label: "状態", render: p => <Badge tone={p.needsReview ? "warn" : p.publishedVersionNo ? "ok" : "muted"}>{p.needsReview ? "レビュー待ち" : p.publishedVersionNo ? "公開済み" : "公開版なし"}</Badge> },
    ]} /></Card>
    {(page > 1 || hasMore) && <div className="flex justify-center gap-4 text-sm">{page > 1 && <Link to={pageLink(page - 1)}>前へ</Link>}<span>{page} ページ</span>{hasMore && <Link to={pageLink(page + 1)}>次へ</Link>}</div>}
    <Card title="製品を作成"><form className="grid gap-3 sm:grid-cols-2" onSubmit={async e => { e.preventDefault();
      const product = await run<ProductIdentity>("POST", "/api/admin/aifind/products", { canonicalName: name, slug, vendorId: vendor || null, reason }, { success: "製品を作成しました。", revalidate: false });
      if (product) navigate(`/admin/aifind/products/${product.id}`);
    }}><Field label="Product name"><Input aria-label="New product name" value={name} required maxLength={200} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Slug" hint="将来の公開 URL です。"><Input aria-label="New product slug" value={slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} onChange={e => setSlug(e.target.value)} /></Field>
      <LookupSelect label="New product vendor" fieldLabel="Vendor" endpoint="/api/admin/aifind/vendors" initialRows={vendors.rows} initialHasMore={vendors.hasMore}
        value={vendor} onChange={setVendor} describe={v => v.name} emptyLabel="未設定" />
      <ReasonField value={reason} onChange={setReason} /><Button type="submit" busy={busy} disabled={!reason.trim()}>製品を作成</Button></form></Card>
  </div></AdminPage>;
}
