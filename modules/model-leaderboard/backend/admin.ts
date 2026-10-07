import { z } from 'zod';
import { tokyoDate } from '@aihot/contracts/time';
import { sql } from '@aihot/backend/db';
import { audit, Conflict } from '@aihot/backend/audit';
import { credential } from '@aihot/backend/config';
import { defineQueue } from '@aihot/backend/modules';
import { enqueueOn, recordRun } from '@aihot/backend/jobs/queue';
import { SOURCE_GROUPS } from './registry.ts';
import { FETCHERS } from './fetch/index.ts';
import { fetchSources, fillContextWindows, refreshFx, refreshLeaderboard, type SourceState } from './fetch/refresh.ts';
import { importModelDirectory } from './directory.ts';
import { importOfficialPrices } from './prices.ts';
import { publicationProblem, runLeaderboardRound } from './method/run.ts';
import { ANCHORS, METHOD_VERSION } from './method/consensus.ts';
import { invalidateLeaderboard } from './read.ts';
import type { LeaderboardAdminModel, LeaderboardAdminOverview, LeaderboardAdminPreview, LeaderboardAdminRun, LeaderboardOperation } from '../admin-contracts.ts';

export const refreshAllowed = () => process.env.COLLECT_ENABLED==='true' && process.env.LEADERBOARD_REFRESH_ENABLED==='true';
const reasonSchema=z.string().trim().min(1).max(500);
const urlSchema=z.url().refine(v=>{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;},'必须是无凭据的 HTTPS 出典链接');
const dateSchema=z.iso.date().refine(v=>v<=tokyoDate(new Date()),'不能使用未来的核验日期');
const supported=()=>new Set(FETCHERS.flatMap(f=>f.sourceKeys));

interface OperationData { operation:LeaderboardOperation; sourceKeys?:string[]; actor:string; reason:string }
export const leaderboardQueue=defineQueue<OperationData>({
  name:'model-leaderboard.operations',
  options:{policy:'exclusive',retryLimit:0,expireInSeconds:1200},
  worker:{localConcurrency:1,batchSize:1},
  run:async data=>{
    if(!['compute','prices'].includes(data.operation)&&!refreshAllowed()) throw new Conflict('榜单采集安全阀已关闭');
    return recordRun('model-leaderboard.operations',async()=>{
      if(data.operation==='compute') return runLeaderboardRound({publish:false});
      if(data.operation==='prices') { const value=await importOfficialPrices(); invalidateLeaderboard(); return value; }
      if(data.operation==='context') {const value=await fillContextWindows();invalidateLeaderboard();return value;}
      if(data.operation==='fx') return refreshFx();
      if(!data.sourceKeys) return refreshLeaderboard();
      await importModelDirectory();
      return fetchSources({sourceKeys:data.sourceKeys});
    });
  },
});

export async function queueLeaderboardOperation(operation:LeaderboardOperation,value:unknown,actor:string) {
  const body=z.strictObject({reason:reasonSchema,sourceKeys:z.array(z.string()).min(1).max(24).optional()}).parse(value);
  if(operation==='refresh') {
    if(!body.sourceKeys?.length||body.sourceKeys.some(key=>!supported().has(key))) throw Object.assign(new Error('请选择已接入的来源'),{statusCode:400});
  }
  if(!['compute','prices'].includes(operation)&&!refreshAllowed()) throw new Conflict('榜单采集安全阀已关闭；需同时启用 COLLECT_ENABLED 和 LEADERBOARD_REFRESH_ENABLED');
  const data:OperationData={operation,actor,reason:body.reason,...(body.sourceKeys?{sourceKeys:[...new Set(body.sourceKeys)].sort()}: {})};
  const jobId=await sql.begin(async tx=>{
    const id=await enqueueOn(leaderboardQueue,data,{singletonKey:'leaderboard'},tx);
    if(id)await audit(actor,'leaderboard.enqueue','leaderboard',body.reason,null,{jobId:id,operation,sourceKeys:data.sourceKeys??null},{db:tx});
    return id;
  });
  return {jobId,duplicate:!jobId};
}

interface RunRow {id:string;status:string;generated_at:Date;methodology_version:string;summary:Record<string,any>;source_snapshot_ids:string[]}
const runDto=(r:RunRow):LeaderboardAdminRun=>({id:r.id,status:r.status,generatedAt:r.generated_at.toISOString(),method:r.methodology_version,boards:r.summary.timings??[]});

export async function leaderboardAdminOverview():Promise<LeaderboardAdminOverview> {
  const [snapshots,state,runs,jobs,quotes]=await Promise.all([
    sql<{source_key:string;record_count:number;published_at:Date|null;fetched_at:Date}[]>`SELECT DISTINCT ON(source_key) source_key,record_count,published_at,fetched_at FROM lb_snapshots ORDER BY source_key,fetched_at DESC`,
    sql<{value:{sources?:Record<string,SourceState>}}[]>`SELECT value FROM settings WHERE key='leaderboard.fetch'`,
    sql<RunRow[]>`SELECT id,status,generated_at,methodology_version,summary,source_snapshot_ids FROM lb_runs ORDER BY generated_at DESC LIMIT 20`,
    sql<{id:number;status:string;started_at:Date;finished_at:Date|null;error:string|null;detail:unknown}[]>`SELECT id,status,started_at,finished_at,error,detail FROM job_runs WHERE job IN('model-leaderboard.operations','model-leaderboard.refresh') ORDER BY started_at DESC LIMIT 10`,
    sql<{as_of:Date;rate:number;source_name:string;source_url:string|null}[]>`SELECT as_of,rate,source_name,source_url FROM fx_rates WHERE pair='USD/CNY' ORDER BY as_of DESC LIMIT 1`,
  ]);
  const available=supported(),byKey=new Map(snapshots.map(s=>[s.source_key,s]));
  const sources=SOURCE_GROUPS.flatMap(g=>g.sources).map(s=>{
    const snapshot=byKey.get(s.key),requiresKey=s.key==='artificial-analysis';
    return {key:s.key,name:s.name,status:s.status,license:s.license,supported:available.has(s.key),requiresKey,configured:!requiresKey||!!credential('collectors','ARTIFICIAL_ANALYSIS_API_KEY'),rows:snapshot?.record_count??0,upstreamAt:snapshot?.published_at?.toISOString()??null,fetchedAt:snapshot?.fetched_at.toISOString()??null,lastAttempt:state[0]?.value.sources?.[s.key]??null};
  });
  const fx=quotes[0];
  return {refreshEnabled:refreshAllowed(),automaticPublication:process.env.LEADERBOARD_AUTO_PUBLISH==='true',sources,runs:runs.map(runDto),jobs:jobs.map(j=>({id:j.id,status:j.status,startedAt:j.started_at.toISOString(),finishedAt:j.finished_at?.toISOString()??null,error:j.error,detail:j.detail})),fx:fx?{asOf:fx.as_of.toISOString().slice(0,10),rate:fx.rate,sourceName:fx.source_name,sourceUrl:fx.source_url}:null};
}

export async function leaderboardAdminModels(query:string):Promise<{rows:LeaderboardAdminModel[]}> {
  const q=z.string().trim().max(200).parse(query);
  const rows=await sql<{slug:string;name:string;context_window_tokens:number|null;context_source_url:string|null;context_verified_at:Date|null;currency:'USD'|'CNY'|null;input:number|null;output:number|null;cached_input:number|null;source_url:string|null;verified_on:Date|null;price_origin:'unknown'|'seed'|'manual'|null;note:string|null}[]>`
    SELECT m.slug,m.name,m.context_window_tokens,m.context_source_url,m.context_verified_at,p.currency,p.input,p.output,p.cached_input,p.source_url,p.verified_on,p.price_origin,p.note
    FROM lb_models m LEFT JOIN lb_prices p ON p.model_id=m.id AND p.kind='official'
    WHERE ${!q} OR m.slug ILIKE ${'%'+q+'%'} OR m.name ILIKE ${'%'+q+'%'} ORDER BY m.name LIMIT 100`;
  return {rows:rows.map(r=>({slug:r.slug,name:r.name,context:{tokens:r.context_window_tokens,sourceUrl:r.context_source_url,verifiedAt:r.context_verified_at?.toISOString()??null},price:r.currency?{currency:r.currency,input:r.input,output:r.output,cached:r.cached_input,sourceUrl:r.source_url,asOf:r.verified_on?.toISOString().slice(0,10)??null,origin:r.price_origin??'unknown',note:r.note}:null}))};
}

export async function saveLeaderboardPrice(slug:string,value:unknown,actor:string) {
  const price=z.number().finite().nonnegative().max(1e7).nullable();
  const b=z.strictObject({currency:z.enum(['USD','CNY']),input:price,output:price,cached:price,sourceUrl:urlSchema,asOf:dateSchema,note:z.string().trim().max(1000).nullable(),reason:reasonSchema}).parse(value);
  await sql.begin(async tx=>{
    const [model]=await tx`SELECT id FROM lb_models WHERE slug=${slug} FOR UPDATE`;
    if(!model)throw Object.assign(new Error('模型不存在'),{statusCode:400});
    const [before]=await tx`SELECT * FROM lb_prices WHERE model_id=${model.id} AND kind='official'`;
    await tx`INSERT INTO lb_prices(model_id,kind,currency,input,output,cached_input,source_url,verified_on,price_origin,note)
      VALUES(${model.id},'official',${b.currency},${b.input},${b.output},${b.cached},${b.sourceUrl},${b.asOf},'manual',${b.note})
      ON CONFLICT(model_id,kind) DO UPDATE SET currency=EXCLUDED.currency,input=EXCLUDED.input,output=EXCLUDED.output,cached_input=EXCLUDED.cached_input,source_url=EXCLUDED.source_url,verified_on=EXCLUDED.verified_on,price_origin='manual',note=EXCLUDED.note,updated_at=now()`;
    await audit(actor,'leaderboard.price',`leaderboard:model:${slug}`,b.reason,before??null,b,{db:tx});
  });
  invalidateLeaderboard();return {ok:true};
}

export async function saveLeaderboardContext(slug:string,value:unknown,actor:string) {
  const b=z.strictObject({tokens:z.number().int().positive().max(1e9).nullable(),sourceUrl:urlSchema,asOf:dateSchema,reason:reasonSchema}).parse(value);
  await sql.begin(async tx=>{
    const [before]=await tx`SELECT id,context_window_tokens,context_source_url,context_verified_at FROM lb_models WHERE slug=${slug} FOR UPDATE`;
    if(!before)throw Object.assign(new Error('模型不存在'),{statusCode:400});
    await tx`UPDATE lb_models SET context_window_tokens=${b.tokens},context_source_url=${b.sourceUrl},context_verified_at=${b.asOf+'T00:00:00Z'},metadata_source='admin',metadata_updated_at=now(),updated_at=now() WHERE id=${before.id}`;
    await audit(actor,'leaderboard.context',`leaderboard:model:${slug}`,b.reason,before,b,{db:tx});
  });
  invalidateLeaderboard();return {ok:true};
}

export async function saveLeaderboardFx(value:unknown,actor:string) {
  const b=z.strictObject({asOf:dateSchema,rate:z.number().finite().positive().max(1000),sourceName:z.string().trim().min(1).max(100),sourceUrl:urlSchema,reason:reasonSchema}).parse(value);
  await sql.begin(async tx=>{
    const [before]=await tx`SELECT * FROM fx_rates WHERE pair='USD/CNY' AND as_of=${b.asOf} FOR UPDATE`;
    await tx`INSERT INTO fx_rates(as_of,pair,rate,source_name,source_url) VALUES(${b.asOf},'USD/CNY',${b.rate},${b.sourceName},${b.sourceUrl}) ON CONFLICT(as_of,pair) DO UPDATE SET rate=EXCLUDED.rate,source_name=EXCLUDED.source_name,source_url=EXCLUDED.source_url,fetched_at=now()`;
    await audit(actor,'leaderboard.fx',`leaderboard:fx:${b.asOf}`,b.reason,before??null,b,{db:tx});
  });
  return {ok:true};
}

function runProblem(run:RunRow) {
  if(run.methodology_version!==METHOD_VERSION)return '方法版本已变更，请重新计算';
  return publicationProblem(run.summary.consensus?.input??[],run.summary.consensus?.boards??[]);
}
export async function leaderboardAdminPreview(id:string):Promise<LeaderboardAdminPreview|null> {
  const [run]=await sql<RunRow[]>`SELECT * FROM lb_runs WHERE id=${id}`;
  if(!run)return null;
  const rankings=await sql<LeaderboardAdminPreview['rankings']>`SELECT r.board,r.rank,r.score,m.name,m.slug FROM lb_rankings r JOIN lb_models m ON m.id=r.model_id WHERE run_id=${id} ORDER BY r.board,r.rank`;
  const snapshots=await sql`SELECT source_key,published_at,fetched_at,record_count,source_url FROM lb_snapshots WHERE id=ANY(${run.source_snapshot_ids}) ORDER BY source_key`;
  return {run:runDto(run),problem:runProblem(run)??null,inputs:(run.summary.consensus?.input??[]).map((b:{board:string;models:string[]})=>({board:b.board,models:b.models.length,anchors:b.models.filter(m=>(ANCHORS as readonly string[]).includes(m)).length})),rankings,snapshots:JSON.parse(JSON.stringify(snapshots))};
}

export async function publishLeaderboardRun(id:string,value:unknown,actor:string) {
  const {reason}=z.strictObject({reason:reasonSchema}).parse(value);
  await sql.begin(async tx=>{
    const [run]=await tx<RunRow[]>`SELECT * FROM lb_runs WHERE id=${id} FOR UPDATE`;
    if(!run||run.status!=='shadow')throw new Conflict('只能审核待发布的候选集计');
    const problem=runProblem(run);if(problem)throw new Conflict(problem);
    const rows=await tx<{board:string;slug:string}[]>`SELECT r.board,m.slug FROM lb_rankings r JOIN lb_models m ON m.id=r.model_id WHERE r.run_id=${id}`;
    for(const input of run.summary.consensus.input as Array<{board:string;models:string[]}>) {
      const actual=rows.filter(r=>r.board===input.board).map(r=>r.slug);
      if(actual.length!==input.models.length||input.models.some(m=>!actual.includes(m)))throw new Conflict('候选排名记录不完整，请重新计算');
    }
    const newer=await tx`SELECT id FROM lb_runs WHERE status='published' AND generated_at>=${run.generated_at} LIMIT 1`;
    if(newer.length)throw new Conflict('已有更新的公开集计，请重新计算');
    await tx`UPDATE lb_runs SET status='published' WHERE id=${id}`;
    await audit(actor,'leaderboard.publish',`leaderboard:run:${id}`,reason,{status:'shadow'},{status:'published'},{db:tx});
  });
  invalidateLeaderboard();return {ok:true};
}
