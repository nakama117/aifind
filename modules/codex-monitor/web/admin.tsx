import { useState } from "react";
import { useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import { adminGet } from "@aihot/web/lib/admin.server";
import { useAdminAction } from "@aihot/web/features/admin/action";
import { AdminPage, Badge, Button, Card, Empty, Input, Textarea } from "../../../apps/web/app/features/admin/ui";
import type { AdminCollection, AdminEvent, AdminMonitor } from "../contracts";

export const meta = () => [{ title: `Codex 监控 · ${SITE.name} 后台` }];
export const loader = ({ request }: { request: Request }) => adminGet<AdminMonitor>(request, "/api/admin/monitor");
const time = (at: string | null) => at ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(at)) + " JST" : "尚未确认";

function EventEditor({ row }: { row: AdminEvent }) {
  const { run, busy } = useAdminAction();
  const [json, setJson] = useState(JSON.stringify(row.event, null, 2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = async (withdrawn?: boolean) => {
    try {
      setError("");
      if (!reason.trim()) { setError("请填写本次变更原因。"); return; }
      const body = withdrawn === undefined ? { event: JSON.parse(json) } : { withdrawn };
      await run("PATCH", `/api/admin/monitor/events/${encodeURIComponent(row.event.id)}`, { ...body, version: row.version, reason }, { success: "记录已更新；所有公开出口同步。" });
    } catch { setError("事件 JSON 格式不正确。"); }
  };
  return <Card>
    <div className="flex flex-wrap items-center gap-2"><Badge tone={row.withdrawn ? "bad" : row.event.status === "confirmed" ? "ok" : "warn"}>{row.withdrawn ? "已撤回" : row.event.status === "confirmed" ? "已确认" : "已公告 / 未确认"}</Badge><span className="font-mono text-xs text-ink-3">{row.event.id}</span><span className="text-xs text-ink-3">{time(row.version)}</span></div>
    <h2 className="mt-3 font-semibold">{row.event.titleJa}</h2><p className="mt-2 text-sm text-ink-3">{row.event.summaryJa}</p>
    <p className="mt-2 text-xs text-ink-3">{row.event.sources.length} 条来源 · {row.event.type === "direct_reset" ? "直接重置额度" : "发放重置卡"} · 确认方式：{row.event.confirmationBasis === "source_post" ? "官方来源确认" : row.event.confirmationBasis === "receipt_review" ? "使用记录核实" : "未确认"}</p>
    <p className="mt-2 text-xs text-ink-3">{row.managedBy === "automatic" ? "自动记录：保存人工修正或撤回后，自动采集将不再覆盖。" : "人工管理：自动识别遇到关联声明会交人工复核。"}</p>
    <details className="mt-4"><summary className="cursor-pointer text-sm text-accent">编辑事件、时间、适用对象和来源</summary><p className="my-2 text-xs text-ink-3">公开文字使用日文。已知时间必须带时区；原文时间不明时 reportedAt / sources[].publishedAt 填 null，sources[].verifiedAt 单独记录实际核验时间。原文只有事件日期且时区未说明时，occurredOn 填原文日期并设 occurredOnTimezone=unspecified。确认完成还需 confirmationBasis、evidenceJa 及 confirmedAt 或 occurredOn；官方确认需 stage=confirmation 来源。仅保存摘要和必要短引文，不粘贴个人账户或凭据信息。</p><Textarea value={json} rows={18} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs" aria-label={`${row.event.id} 事件 JSON`} /></details>
    <div className="mt-4 flex flex-wrap gap-2"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="变更原因（内部审计，不公开）" aria-label="变更原因" className="min-w-[220px] flex-1" /><Button disabled={busy || !reason.trim()} onClick={() => void submit()}>保存修正</Button><Button disabled={busy || !reason.trim()} tone="ghost" onClick={() => void submit(!row.withdrawn)}>{row.withdrawn ? "恢复公开" : "撤回"}</Button></div>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </Card>;
}

function CollectionControls({ data }: { data: AdminCollection }) {
  const { run, busy } = useAdminAction();
  const [sources, setSources] = useState(JSON.stringify(data.settings.sources, null, 2));
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const save = async () => {
    try { setNote(""); await run("PUT", "/api/admin/monitor/sources", { sources: JSON.parse(sources), version: data.settings.version, reason }, { success: "来源配置已保存并审计。运行安全阀保持环境中的设置。" }); }
    catch { setNote("来源配置不是有效 JSON。"); }
  };
  const scan = async () => {
    const result = await run<{ skipped: boolean; queued?: boolean }>("POST", "/api/admin/monitor/scan", {}, { success: "扫描请求已处理。" });
    if (result) setNote(result.skipped ? "CODEX_MONITOR_ENABLED / COLLECT_ENABLED 未全部开启，本次未排队。" : result.queued ? "已进入 worker 队列。采集后仅在模型安全阀开启时识别；请稍后刷新查看结果。" : "已有待处理扫描任务。请稍后刷新查看结果。");
  };
  return <Card className="mt-4" title="重置公告自动采集">
    <p className="text-sm text-ink-3">官方帮助页和博客源免费读取；启用的 X 账号通过现有 SocialData 适配器按供应商计费。OpenAI 独立声明识别经过回执与全站月预算。网页浏览不会触发模型。凭据仅由服务端读取，本页不接收或显示密钥。</p>
    <div className="my-3 flex flex-wrap gap-2"><Badge tone={data.enabled ? "ok" : "warn"}>{data.enabled ? "公告采集安全阀开启" : "公告采集安全阀关闭"}</Badge><Badge tone={data.modelEnabled ? "ok" : "warn"}>{data.modelEnabled ? "模型安全阀开启" : "模型安全阀关闭"}</Badge><Badge tone="muted">{data.socialdataConfigured ? "SocialData 凭据已配置（不代表来源启用或已成功）" : "SocialData 未配置"}</Badge></div>
    <ul className="space-y-2 text-sm">{data.sources.map((source) => <li key={source.id}><span className="font-mono">{source.id}</span> · {{ disabled: "停用", never: "尚未采集", ok: "来源读取成功", failed: "上次采集失败", missing_credentials: "缺少 SocialData 凭据" }[source.status] ?? source.status} · 最近尝试 {time(source.lastAttemptAt)} · 成功 {time(source.lastSuccessAt)}{source.backlog > 0 ? ` · 待读分页 ${source.backlog}` : ""}{source.dropped > 0 ? ` · 存在历史分页缺口 ${source.dropped}` : ""}{source.failureCode ? ` · ${source.failureCode}` : ""}</li>)}</ul>
    <div className="my-4"><Button disabled={busy || !data.enabled} onClick={() => void scan()}>排队采集并识别公告</Button></div>
    <details><summary className="cursor-pointer text-sm text-accent">配置官方页面、博客 feed 与 X 账号</summary><p className="my-2 text-xs text-ink-3">official_page / official_feed 使用 url；x_search 使用 handle（thsottiaux / OpenAI / OpenAIDevs）。每项有唯一 id 和 enabled。来源变更不删除已发布记录。X 默认停用；启用 X 需要已配置凭据并接受供应商费用。安全阀由部署环境控制，此处不能开启。</p><Textarea aria-label="公告来源配置 JSON" value={sources} onChange={(event) => setSources(event.target.value)} rows={15} className="font-mono text-xs" /><div className="mt-3 flex gap-2"><Input aria-label="来源配置变更原因" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="来源配置变更原因" /><Button disabled={busy || !reason.trim()} onClick={() => void save()}>保存来源</Button></div></details>
    {note && <p role="status" className="mt-3 text-sm text-ink-3">{note}</p>}
  </Card>;
}

function DocumentReview({ document }: { document: AdminCollection["documents"][number] }) {
  const { run, busy } = useAdminAction();
  const [recognition, setRecognition] = useState(JSON.stringify(document.recognition, null, 2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const review = async (action: "approve" | "dismiss" | "retry") => {
    try {
      setError("");
      await run("POST", `/api/admin/monitor/documents/${document.id}/review`, { action, reason, version: document.version, ...(action === "approve" ? { recognition: JSON.parse(recognition) } : {}) }, { success: action === "retry" ? "失败记录已恢复待处理，下次 worker 扫描会重试。" : "来源修订已审核并审计。" });
    } catch { setError("识别结果不是有效 JSON。"); }
  };
  return <details className="mt-3 rounded border border-line p-3"><summary className="cursor-pointer text-sm"><span className="font-mono">{document.sourceKey}</span> · {{ pending: "待识别", processed: "已处理", review: "待人工复核", failed: "处理失败", dismissed: "已人工忽略" }[document.status] ?? document.status} · {time(document.observedAt)}</summary>
    <p className="my-2 text-xs text-ink-3">原文发布时间：{document.publishedAt ? time(document.publishedAt) : "未知"} · 抓取时间：{time(document.observedAt)} · 模型回执：{document.receiptId ?? "未调用"}</p><a href={document.url} target="_blank" rel="noreferrer" className="text-sm text-accent">核对官方原文 ↗</a>
    {document.reviewReason && <p className="my-2 text-sm">处理说明：{document.reviewReason}</p>}
    <details className="my-3"><summary className="cursor-pointer text-sm">采集到的原文（仅后台，属于不可信资料）</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs">{document.text}</pre></details>
    {document.recognition !== null && <><p className="my-2 text-xs text-ink-3">可逐条修正声明后审核应用。连续原文引文、事件关联、时间依据仍会校验；已审核事件转为人工管理。原文缺少精确时间请保持 null。</p><Textarea value={recognition} onChange={(event) => setRecognition(event.target.value)} aria-label={`${document.id} 识别结果`} rows={12} className="font-mono text-xs" /></>}
    <div className="mt-3 flex flex-wrap gap-2"><Input aria-label={`${document.id} 审核原因`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="审核原因（审计必填）" className="min-w-[220px] flex-1" />{document.recognition !== null && <Button disabled={busy || !reason.trim()} onClick={() => void review("approve")}>审核应用</Button>}<Button tone="ghost" disabled={busy || !reason.trim()} onClick={() => void review("dismiss")}>忽略这次修订</Button>{document.status === "failed" && <Button tone="ghost" disabled={busy || !reason.trim()} onClick={() => void review("retry")}>重试失败</Button>}</div>
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
  </details>;
}

export default function MonitorAdminPage() {
  const data = useLoaderData<typeof loader>();
  const { run, busy } = useAdminAction();
  const [payload, setPayload] = useState('{\n  "events": [],\n  "reason": ""\n}');
  const [error, setError] = useState("");
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [refreshNote, setRefreshNote] = useState("");
  const importBatch = async () => {
    try { setError(""); const parsed: unknown = JSON.parse(payload); await run("POST", "/api/admin/monitor/import", parsed, { success: "已导入并记录人工核验时间。" }); }
    catch { setError("导入内容不是有效的 JSON。"); }
  };
  const refresh = async () => {
    const result = await run<{ skipped: boolean; count?: number }>("POST", "/api/admin/monitor/refresh", {}, { success: "刷新操作已记录。" });
    if (result) setRefreshNote(result.skipped ? "采集安全阀 COLLECT_ENABLED 未开启，本次未访问外部服务。" : `已保存 ${result.count} 条 Codex 相关官方服务事件；不代表额度重置已核验。`);
  };
  const rows = data.events.filter((e) => showWithdrawn || !e.withdrawn);
  return <AdminPage title="Codex 公告监控" subtitle="管理公开额度重置公告与核实依据。手动导入和修正留有审计；不读取个人 Codex 余额。" actions={<a href="/codex-reset" target="_blank" rel="noreferrer" className="text-sm text-accent">打开日文公开页 ↗</a>}>
    <Card title="核验与服务状态"><p className="text-sm text-ink-3">来源读取成功、声明识别完成、人工核验分别记录。下面的免费服务状态只用于障碍提示，不代表重置监控正常，也不会从时间经过或故障恢复推断“已重置”。</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div>最后人工核验：{time(data.monitor.lastReviewedAt)}</div><div>公告设置范围处理完成：{time(data.monitor.lastAnnouncementCompleteAt)}</div><div>公告未处理：{data.monitor.pendingDocuments} · 待复核：{data.monitor.reviewDocuments}</div><div>状态源最后成功：{time(data.monitor.lastStatusSuccessAt)}</div><div>状态源最后尝试：{time(data.monitor.lastStatusAttemptAt)}</div><div>状态源：{data.monitor.statusFetch === "failed" ? "上次刷新失败，保留旧数据" : data.monitor.statusFetch === "ok" ? "已获取" : "尚未获取"}</div></div><div className="mt-4 flex flex-wrap items-center gap-3"><Button disabled={busy} onClick={() => void refresh()}>刷新官方服务状态</Button><span className="text-xs text-ink-3">{data.monitor.collectionEnabled ? "采集开启，worker 每 10 分钟刷新状态源" : "采集关闭；刷新不会访问外部网络"}</span></div>{refreshNote && <p role="status" className="mt-3 text-sm text-ink-3">{refreshNote}</p>}</Card>
    <CollectionControls key={data.collection.settings.version ?? "default"} data={data.collection} />
    <Card className="mt-4" title="来源修订与人工复核"><p className="text-sm text-ink-3">显示最近 40 条，待处理优先。完整原文与模型回执仅后台可见。修订被忽略不等于撤回事件；撤回公开记录使用下方事件操作。</p>{data.collection.documents.length ? data.collection.documents.map((document) => <DocumentReview key={`${document.id}-${document.version}`} document={document} />) : <Empty>尚未保存公告来源修订。</Empty>}</Card>
    <Card className="mt-4" title="导入已人工核验的公告"><p className="mb-3 text-sm text-ink-3">导入结构：events 数组 + reason。每条事件都须有官方原文、发布时间和日文摘要；已确认事件须附明确确认依据。同 ID 不覆盖，修改请用下方事件编辑。完整字段和操作见项目文档 docs/codex-monitor-jp.md。</p><label className="mb-2 block text-sm">选择 JSON 文件 <input type="file" accept="application/json,.json" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 2 * 1024 * 1024) { setError("文件不得超过 2 MiB。"); return; } setPayload(await file.text()); }} /></label><Textarea value={payload} onChange={(e) => setPayload(e.target.value)} rows={10} className="font-mono text-xs" aria-label="公告导入 JSON" /><div className="mt-3"><Button disabled={busy} onClick={() => void importBatch()}>核验后导入</Button></div>{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}</Card>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">公告事件 · {rows.length}</h2><label className="text-sm"><input type="checkbox" checked={showWithdrawn} onChange={(e) => setShowWithdrawn(e.target.checked)} /> 显示已撤回</label></div>
    <div className="space-y-4">{rows.length ? rows.map((row) => <EventEditor key={`${row.event.id}-${row.version}`} row={row} />) : <Card><Empty>暂无已核验公告。不会自动填充历史或模拟数据。</Empty></Card>}</div>
  </AdminPage>;
}
