import { Form, Link, useLoaderData, useSearchParams } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { AdminPage, Badge, Button, Card, DataTable, Field, Input, Select } from "../../../apps/web/app/features/admin/ui.tsx";
import type { CandidateList, ProductAdminList, AdminLookup } from "../admin/contracts.ts";
import type { Evidence } from "../contracts.ts";
import { AdminNav, adminHeaders, adminMeta, ValueRows, labels } from "./admin-common.tsx";
import { At } from "./product-view.tsx";
import CandidateEditor from "./candidate-editor.tsx";
export const meta = () => adminMeta("Review Queue");
export const headers = adminHeaders;
export async function loader({ request }: { request: Request }) {
  const sp = new URL(request.url).searchParams, query = new URLSearchParams({ q: sp.get("q") ?? "", status: sp.get("status") ?? "pending_review", page: sp.get("page") ?? "1" });
  const [list, products, evidence] = await Promise.all([adminGet<CandidateList>(request, `/api/admin/aifind/candidates?${query}`), adminGet<ProductAdminList>(request, "/api/admin/aifind/products?filter=published"), adminGet<AdminLookup<Evidence>>(request, "/api/admin/aifind/evidence")]);
  return { ...list, products, evidence: evidence.rows };
}
export default function ReviewPage() {
  const { rows, page, hasMore, products, evidence } = useLoaderData<typeof loader>(); const [sp] = useSearchParams();
  const pageLink = (next: number) => { const copy = new URLSearchParams(sp); copy.set("page", String(next)); return `?${copy}`; };
  return <AdminPage title="Review Queue" subtitle="手動の提案を確認し、承認後に Draft へ適用します。公開は別操作です。"><div lang="ja" className="space-y-5"><AdminNav />
    <Form method="get" className="flex flex-wrap items-end gap-3"><Field label="製品名で検索"><Input name="q" aria-label="Review product search" defaultValue={sp.get("q") ?? ""} maxLength={100} /></Field>
      <Field label="状態"><Select name="status" aria-label="Review status filter" defaultValue={sp.get("status") ?? "pending_review"}>{["pending_review", "approved", "rejected", "applied", "all"].map(v => <option key={v} value={v}>{v === "all" ? "すべて" : `${labels[v]} (${v})`}</option>)}</Select></Field><Button type="submit">検索</Button></Form>
    <Card pad={false}><DataTable rows={rows} rowKey={d => d.candidate.id} empty="この状態の提案はありません。" dense columns={[
      { key: "product", label: "Product / Field", render: d => <div><Link className="text-accent underline" to={`/admin/aifind/review/${d.candidate.id}`}>{d.productName}</Link><p className="mt-1 text-xs">{d.candidate.candidateType} / {d.candidate.targetKey}</p></div> },
      { key: "current", label: "Current", render: d => <ValueRows value={d.currentValue} /> }, { key: "proposed", label: "Proposed", render: d => <ValueRows value={d.candidate.proposedValue} /> },
      { key: "evidence", label: "Evidence", render: d => <div className="max-w-[220px] break-words text-xs"><p>{d.evidence.sourceKind}</p><a className="break-all text-accent underline" href={d.evidence.url} target="_blank" rel="noopener noreferrer">{d.evidence.title ?? d.evidence.url}</a></div> },
      { key: "created", label: "Created at", render: d => <At at={d.candidate.createdAt} /> }, { key: "status", label: "Status", render: d => <Badge tone={d.candidate.status === "pending_review" ? "warn" : d.candidate.status === "applied" ? "ok" : "muted"}>{labels[d.candidate.status] ?? d.candidate.status}</Badge> },
    ]} /></Card>
    {(page > 1 || hasMore) && <div className="flex justify-center gap-4 text-sm">{page > 1 && <Link to={pageLink(page - 1)}>前へ</Link>}<span>{page} ページ</span>{hasMore && <Link to={pageLink(page + 1)}>次へ</Link>}</div>}
    <Card title="Manual Candidate"><CandidateEditor products={products} evidence={evidence} /></Card>
  </div></AdminPage>;
}
