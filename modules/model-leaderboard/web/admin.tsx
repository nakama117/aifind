import { useState, type ReactNode } from 'react';
import { Form, Link, useLoaderData, type LoaderFunctionArgs } from 'react-router';
import { adminGet } from '@aihot/web/lib/admin.server';
import { useAdminAction } from '@aihot/web/features/admin/action';
import { AdminPage, Button, Card, Input } from '../../../apps/web/app/features/admin/ui.tsx';
import type { LeaderboardAdminModel, LeaderboardAdminOverview, LeaderboardAdminPreview, LeaderboardOperation } from '../admin-contracts.ts';
import { stamp } from './format';

const API='/api/admin/model-leaderboard';
export const meta=()=>[{title:'模型排行榜 · 管理后台'},{name:'robots',content:'noindex, nofollow'}];
export async function loader({request}:LoaderFunctionArgs) {
  const params=new URL(request.url).searchParams,q=params.get('q')??'',id=params.get('run');
  const [overview,models,preview]=await Promise.all([
    adminGet<LeaderboardAdminOverview>(request,API),
    adminGet<{rows:LeaderboardAdminModel[]}>(request,API+'/models?q='+encodeURIComponent(q)),
    id?adminGet<LeaderboardAdminPreview>(request,API+'/runs/'+encodeURIComponent(id)):null,
  ]);
  return {overview,models,preview,q};
}

function Field({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}) {
  return <label className="block text-[13px]"><span className="mb-1 block text-ink-3">{label}</span><Input type={type} value={value} onChange={e=>onChange(e.target.value)}/></label>;
}
function Note({children}:{children:ReactNode}) {return <p className="my-2 text-[12px] leading-relaxed text-ink-3">{children}</p>;}
const numberOrNull=(s:string)=>s.trim()===''?null:Number.isFinite(Number(s))?Number(s):s;

function ModelEditor({model,reason}:{model:LeaderboardAdminModel;reason:string}) {
  const {run,busy}=useAdminAction();
  const p=model.price;
  const [input,setInput]=useState(p?.input?.toString()??''),[output,setOutput]=useState(p?.output?.toString()??''),[cached,setCached]=useState(p?.cached?.toString()??'');
  const [currency,setCurrency]=useState(p?.currency??'USD'),[url,setUrl]=useState(p?.sourceUrl??''),[asOf,setAsOf]=useState(p?.asOf??''),[note,setNote]=useState(p?.note??'');
  const [tokens,setTokens]=useState(model.context.tokens?.toString()??''),[contextUrl,setContextUrl]=useState(model.context.sourceUrl??''),[contextDate,setContextDate]=useState(model.context.verifiedAt?.slice(0,10)??'');
  return <div className="space-y-4 border-t border-line pt-4"><h3 className="font-medium">{model.name} <small className="text-ink-3">{model.slug}</small></h3>
    <Note>价格为每百万 token 的原币种记录。空白表示未知，0 表示已确认免费。保存会更新公开的补充信息，不会修改模型能力排名。来源标签：{p?.origin??'unknown'}；原始核验日：{p?.asOf??'未知'}。</Note>
    <div className="grid gap-3 sm:grid-cols-3"><label className="text-[13px]">币种<select className="mt-1 block w-full rounded border border-line bg-bg p-2" value={currency} onChange={e=>setCurrency(e.target.value as 'USD'|'CNY')}><option>USD</option><option>CNY</option></select></label><Field label="输入价格" value={input} onChange={setInput}/><Field label="输出价格" value={output} onChange={setOutput}/><Field label="缓存命中输入价格" value={cached} onChange={setCached}/><Field label="价格核验日期（UTC日）" type="date" value={asOf} onChange={setAsOf}/><Field label="官方价格 HTTPS 出典" value={url} onChange={setUrl}/></div>
    <Field label="日文说明（公开显示；若完全没有官方付费API请明确说明）" value={note} onChange={setNote}/>
    <Button disabled={busy||!reason.trim()||!asOf||!url} onClick={()=>run('POST',`${API}/models/${encodeURIComponent(model.slug)}/price`,{currency,input:numberOrNull(input),output:numberOrNull(output),cached:numberOrNull(cached),sourceUrl:url,asOf,note:note||null,reason},{success:'价格记录已保存'})}>保存价格记录</Button>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="上下文 token 数（空白=未知）" value={tokens} onChange={setTokens}/><Field label="规格核验日期（UTC日）" type="date" value={contextDate} onChange={setContextDate}/><Field label="上下文规格 HTTPS 出典" value={contextUrl} onChange={setContextUrl}/></div>
    <Button disabled={busy||!reason.trim()||!contextDate||!contextUrl} onClick={()=>run('POST',`${API}/models/${encodeURIComponent(model.slug)}/context`,{tokens:numberOrNull(tokens),sourceUrl:contextUrl,asOf:contextDate,reason},{success:'上下文记录已保存'})}>保存上下文记录</Button>
  </div>;
}

function FxEditor({value,reason}:{value:LeaderboardAdminOverview['fx'];reason:string}) {
  const {run,busy}=useAdminAction();
  const [date,setDate]=useState(value?.asOf??''),[rate,setRate]=useState(value?.rate.toString()??''),[source,setSource]=useState(value?.sourceName??''),[url,setUrl]=useState(value?.sourceUrl??'');
  return <><div className="grid gap-3 sm:grid-cols-2"><Field label="报价日期（UTC日）" type="date" value={date} onChange={setDate}/><Field label="1 USD 对应 CNY" value={rate} onChange={setRate}/><Field label="来源名称" value={source} onChange={setSource}/><Field label="HTTPS 出典" value={url} onChange={setUrl}/></div><Note>保存汇率后需计算候选集计并审核发布；已公开集计继续保留其当时使用的汇率与日期。</Note><Button disabled={busy||!reason.trim()||!date||!rate||!source||!url} onClick={()=>run('POST',API+'/fx',{asOf:date,rate:Number(rate),sourceName:source,sourceUrl:url,reason},{success:'汇率记录已保存'})}>保存汇率</Button></>;
}

export default function LeaderboardAdmin() {
  const {overview,models,preview,q}=useLoaderData<typeof loader>();
  const {run,busy}=useAdminAction();
  const [reason,setReason]=useState(''),[chosen,setChosen]=useState<string[]>([]),[editing,setEditing]=useState(''),[reviewed,setReviewed]=useState(false),[notice,setNotice]=useState('');
  const model=models.rows.find(m=>m.slug===editing);
  const enqueue=async(operation:LeaderboardOperation)=>{
    const response=await run<{jobId:string|null;duplicate:boolean}>('POST',API+(operation==='refresh'?'/refresh':`/queue/${operation}`),{reason,...(operation==='refresh'?{sourceKeys:chosen}:{})});
    if(response){setReviewed(false);setNotice(response.duplicate?'已有榜单任务等待或执行中，本次操作没有入队。请待任务完成后重试。':`任务已入队：${response.jobId}`);}
  };
  return <AdminPage title="模型排行榜" subtitle="采集、元数据维护和候选集计审核。所有时间显示为 JST；原始日期与抓取时间分别保留。">
    <div className="space-y-5">{notice&&<p role="status" className="rounded border border-line p-3 text-[13px]">{notice}</p>}<Card title="操作原因与安全阀"><Field label="来源核验或操作原因（所有写操作记入审计日志）" value={reason} onChange={setReason}/><Note>网络刷新：{overview.refreshEnabled?'已允许':'已关闭'}。需要 COLLECT_ENABLED 和 LEADERBOARD_REFRESH_ENABLED 同时为 true。点击按钮只排队，由 worker 执行；不会发起付费推理。定时发布模式：{overview.automaticPublication?"自动发布（原有质量门槛全部通过后）":"待审核（候选不影响公开排名）"}。手工“计算候选”始终需要审核。</Note><div className="flex flex-wrap gap-2"><Button disabled={busy||!reason.trim()||!overview.refreshEnabled||!chosen.length} onClick={()=>enqueue('refresh')}>采集选中来源（{chosen.length}）</Button><Button disabled={busy||!reason.trim()} onClick={()=>enqueue('compute')}>计算待审核候选</Button><Button disabled={busy||!reason.trim()||!overview.refreshEnabled} onClick={()=>enqueue('context')}>补充缺失上下文</Button><Button disabled={busy||!reason.trim()||!overview.refreshEnabled} onClick={()=>enqueue('fx')}>取得公开汇率</Button><Button disabled={busy||!reason.trim()} onClick={()=>enqueue('prices')}>导入有日期的价格种子</Button></div><Note>定时自动发布由 LEADERBOARD_AUTO_PUBLISH=true 明确开启，默认待审核；此设置不会放宽任何证据门槛。价格种子只补空记录，保留原文件核验日期；它不是当前价格查询。OpenRouter 只补缺失上下文，返回值会记录该次确认时间。</Note></Card>
    <Card title={`数据来源（${overview.sources.filter(s=>s.supported).length} 已接入 / ${overview.sources.length} 目录项）`}><div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead><tr><th>选择 / 来源</th><th>接入与最后结果</th><th>原始公开时间 / 快照抓取时间</th><th>使用条件</th></tr></thead><tbody>{overview.sources.map(s=><tr key={s.key} className="border-t border-line align-top"><td className="p-2"><label className="flex gap-2"><input type="checkbox" disabled={!s.supported||!s.configured} checked={chosen.includes(s.key)} onChange={e=>setChosen(e.target.checked?[...chosen,s.key]:chosen.filter(k=>k!==s.key))}/><span><Link className="text-accent underline" to={`/leaderboard/sources/${s.key}`} target="_blank">{s.name}</Link><small className="block">{s.key}</small></span></label></td><td className="p-2">{!s.supported?'观察目录，尚无自动适配器':!s.configured?'未配置 Artificial Analysis 免费 API Key':s.lastAttempt?s.lastAttempt.ok?'上次采集成功':'上次采集失败，保留已有实测':'尚未采集'}<small className="block">{s.rows} 条代表结果 · 检查 {stamp(s.lastAttempt?.at)}</small>{s.lastAttempt?.error&&<small className="block text-hot">{s.lastAttempt.error}</small>}</td><td className="p-2">发布 {stamp(s.upstreamAt)}<br/>抓取 {stamp(s.fetchedAt)}<br/>最近成功 {stamp(s.lastAttempt?.lastOkAt)}</td><td className="max-w-[280px] p-2">{s.license}</td></tr>)}</tbody></table></div></Card>
    <Card title="运行记录与审核"><div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead><tr><th>集计</th><th>状态 / 方法</th><th>各榜模型数</th></tr></thead><tbody>{overview.runs.map(r=><tr key={r.id} className="border-t border-line"><td className="py-2"><Link to={`?run=${encodeURIComponent(r.id)}`} className="text-accent underline">{stamp(r.generatedAt)}</Link><small className="block">{r.id}</small></td><td>{r.status}<small className="block">{r.method}</small></td><td>{r.boards.map(b=>`${b.board}: ${b.models}${b.optimal?'':'（非最优）'}`).join(' · ')}</td></tr>)}</tbody></table></div>
      {preview&&<section className="mt-5 space-y-3 border-t border-line pt-4"><h3 className="font-medium">候选详情：{preview.run.id}</h3><Note>算法条件：{preview.problem??'通过原有门槛'}。{preview.inputs.map(b=>`${b.board} ${b.models}模型 / ${b.anchors}参照`).join('；')}</Note><div className="overflow-x-auto"><table className="w-full text-left text-[12px]"><thead><tr><th>来源</th><th>原始发布</th><th>抓取</th><th>条目</th></tr></thead><tbody>{preview.snapshots.map(s=><tr key={s.source_key}><td><a href={s.source_url??undefined} target="_blank" rel="noreferrer" className="text-accent underline">{s.source_key}</a></td><td>{stamp(s.published_at)}</td><td>{stamp(s.fetched_at)}</td><td>{s.record_count}</td></tr>)}</tbody></table></div><details><summary>展开全部候选排名（{preview.rankings.length} 条）</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{preview.rankings.map(r=><p className="text-[12px]" key={`${r.board}-${r.slug}`}>{r.board} #{r.rank} · {r.name} · {r.score?.toFixed(2)??'未知'}</p>)}</div></details><label className="block text-[13px]"><input type="checkbox" checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/> 已核对实测、日期、原有算法门槛与出典使用条件</label><Button tone="primary" disabled={busy||!reason.trim()||!reviewed||preview.run.status!=='shadow'||!!preview.problem} onClick={()=>run('POST',`${API}/runs/${preview.run.id}/publish`,{reason},{success:'审核通过，集计已公开'})}>审核并发布此候选</Button></section>}
    </Card>
    <Card title="模型价格与上下文"><Form method="get" className="flex gap-2"><Input name="q" defaultValue={q} placeholder="模型名或 slug"/><Button type="submit">查询</Button></Form><Note>最多显示匹配的 100 个模型。核验日期必须来自实际来源；未确认不补今天的日期。</Note><select aria-label="选择要维护的模型" className="w-full rounded border border-line bg-bg p-2 text-[13px]" value={editing} onChange={e=>setEditing(e.target.value)}><option value="">选择模型</option>{models.rows.map(m=><option value={m.slug} key={m.slug}>{m.name}</option>)}</select>{model&&<ModelEditor key={model.slug} model={model} reason={reason}/>}</Card>
    <Card title="汇率维护"><FxEditor value={overview.fx} reason={reason}/></Card>
    <Card title="最近后台任务"><Note>排队任务需要 worker 正在运行。任务失败不会清空上次有效的实测或公开榜单。</Note>{overview.jobs.length?overview.jobs.map(j=><details key={j.id} className="border-t border-line py-2"><summary className="text-[13px]">{stamp(j.startedAt)} · {j.status} · 完成 {stamp(j.finishedAt)}</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">{j.error??JSON.stringify(j.detail,null,2)}</pre></details>):<Note>还没有已执行的后台任务。</Note>}</Card>
    </div>
  </AdminPage>;
}
