import { useState } from "react";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Button, Card, Input } from "../../../apps/web/app/features/admin/ui.tsx";
import type { HistoryRecord } from "../backend/store.ts";

export const meta = () => [{ title: "主题大事记 · 管理后台" }];
export function loader({ request }: LoaderFunctionArgs) {
  return adminGet<{ rows: HistoryRecord[] }>(request, "/api/admin/topic-chronicle");
}

export default function ChronicleAdmin() {
  const { rows } = useLoaderData<typeof loader>();
  const [document, setDocument] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const { run, busy } = useAdminAction();
  const importHistory = async () => {
    try {
      const parsed: unknown = JSON.parse(document);
      setError("");
      await run("POST", "/api/admin/topic-chronicle/import", { document: parsed, reason }, { success: "大事记已导入并公开" });
    } catch { setError("JSON 格式错误，请修正后再导入。"); }
  };
  return <AdminPage title="主题大事记" subtitle="历史档案与新闻独立管理。每条必须包含真实原始日期、日文标题、出典名称与 HTTPS 原文链接。">
    <div className="space-y-5">
      <Card title="导入与编辑历史档案">
        <p className="mb-3 text-[13px] leading-relaxed text-ink-3">导入会替换该主题的历史档案并公开。先用下方“编辑 JSON”载入已有内容；新增主题可复制其结构。compiledOn 是编制日期，through 是资料收录到的月份，不会隐藏同月的自动新闻。events 中的 date 保留原始日期精度；item 可关联同一事件的站内文章，合并重复节点。</p>
        <label className="block text-[13px] font-medium" htmlFor="chronicle-json">档案 JSON</label>
        <textarea id="chronicle-json" rows={14} value={document} onChange={(e) => setDocument(e.target.value)} className="mt-2 w-full rounded-tile border border-line bg-bg p-3 font-mono text-[12px]" spellCheck={false} />
        <label className="mt-3 block text-[13px] font-medium" htmlFor="chronicle-reason">来源核验与修改原因（记录到审计日志）</label>
        <Input id="chronicle-reason" className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p role="alert" className="mt-2 text-[13px] text-hot">{error}</p>}
        <Button className="mt-3" tone="primary" disabled={busy || !document.trim() || !reason.trim()} onClick={importHistory}>导入并公开</Button>
      </Card>
      <Card title="现有历史档案">
        <div className="space-y-4">
          {rows.map((r) => <div key={r.topic} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3 last:border-0">
            <div><a className="font-medium text-accent underline" href={`/topics/${r.topic}`} target="_blank" rel="noopener noreferrer">{r.topic}</a>
              <p className="mt-1 text-[12px] text-ink-3">{r.enabled ? "公开中" : "已撤下"} · {r.document.events.length} 条 · 编制 {r.document.compiledOn} · 覆盖至 {r.document.through}</p></div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setDocument(JSON.stringify(r.document, null, 2))}>编辑 JSON</Button>
              <Button size="sm" tone={r.enabled ? "danger" : "primary"} disabled={busy || !reason.trim()} onClick={() => run("POST", `/api/admin/topic-chronicle/${encodeURIComponent(r.topic)}/visibility`, { enabled: !r.enabled, reason }, { success: r.enabled ? "历史档案已撤下" : "历史档案已公开" })}>{r.enabled ? "撤下" : "公开"}</Button>
            </div>
          </div>)}
        </div>
        <p className="mt-3 text-[12px] text-ink-4">撤下或重新公开也使用上面的修改原因。相关新闻仍由统一公开读取层决定是否显示。</p>
      </Card>
    </div>
  </AdminPage>;
}
