import { SITE } from "@aihot/site";
import { Form, Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/content";
import type { AdminContentSearch } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { VISIBILITY_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, DataTable, Input, Pager, Select, Time } from "../../features/admin/ui";


export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminContentSearch>(request, `/api/admin/content${new URL(request.url).search}`);
}

export const meta: Route.MetaFunction = () => [{ title: `内容管理 · ${SITE.name} 后台` }];

export default function Content({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, pageSize, sources } = loaderData;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  return (
    <AdminPage title="内容管理" subtitle="按发现时间列出全部文章。点击标题可修改日文标题与摘要、调整精选、撤稿或恢复，也可查看评分、费用与操作记录。">
      <Form key={sp.toString()} method="get" className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="内容 ID、URL 或日文标题关键词" aria-label="搜索内容" />
        <Select name="state" aria-label="发布状态" defaultValue={sp.get("state") ?? ""}>
          <option value="">全部状态</option><option value="public">公开</option><option value="summary-only">仅摘要</option>
          <option value="withdrawn">已撤稿</option><option value="unpublished">未公开</option><option value="failed">处理失败</option>
        </Select>
        <Select name="selected" aria-label="精选状态" defaultValue={sp.get("selected") ?? ""}>
          <option value="">全部精选状态</option><option value="true">精选</option><option value="false">普通资讯</option>
        </Select>
        <Select name="source" aria-label="信源" defaultValue={sp.get("source") ?? ""}>
          <option value="">全部信源</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Button type="submit" tone="primary">筛选</Button>
      </Form>
        <Card pad={false} title={`共 ${total} 条内容`} right={<Link to="/admin/content" className="text-accent">清除筛选</Link>}>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/content/${r.id}`)}
            empty="没有符合条件的内容。可清除筛选，或尝试日文标题、原文标题和原文链接。"
            columns={[
              {
                key: "t",
                label: "标题",
                render: (r) => (
                  <div className="min-w-[320px]">
                    <Link to={`/admin/content/${r.id}`} className="font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>{r.title}</Link>
                    <div className="font-mono text-[11.5px] text-ink-4">{r.id}</div>
                  </div>
                ),
              },
              { key: "src", label: "信源", render: (r) => <span className="whitespace-nowrap">{r.source}</span> },
              {
                key: "st",
                label: "状态",
                render: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.selected && <Badge tone="accent">精选</Badge>}
                    {r.visibility && <Badge tone={r.visibility === "public" ? "muted" : "warn"}>{VISIBILITY_LABEL[r.visibility] ?? r.visibility}</Badge>}
                    {!r.visibility && <Badge>{r.processing_state}</Badge>}
                  </span>
                ),
              },
              { key: "sc", label: "分数", align: "right", render: (r) => r.score ?? "—" },
              { key: "d", label: "发现", render: (r) => <Time at={r.discovered_at} /> },
            ]}
          />
        </Card>
      <Pager page={page} hasMore={page * pageSize < total} />
    </AdminPage>
  );
}
