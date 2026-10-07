import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import Fastify from 'fastify';
import { config } from '@aihot/backend/config';
import { sql, closeDb } from '@aihot/backend/db';
import { stopBoss } from '@aihot/backend/jobs/queue';
import { registerLeaderboard } from '../api/routes.ts';
import { ANCHORS, METHOD_VERSION } from '../backend/method/consensus.ts';
import { invalidateLeaderboard } from '../backend/read.ts';

const original = { dev: config.devAdmin, environment: config.environmentName };
const app = Fastify();
registerLeaderboard(app);
after(async () => { config.devAdmin = original.dev; config.environmentName = original.environment; await app.close(); await stopBoss(); await closeDb(); });
const path = '/api/admin/model-leaderboard';
const send = (url: string, payload: Record<string,unknown>) => app.inject({method:'POST',url:path+url,headers:{'x-csrf-token':'dev'},payload});

test('leaderboard management is private and every mutation requires the existing CSRF guard', async () => {
  config.devAdmin = null;
  assert.equal((await app.inject(path)).statusCode,401);
  assert.equal((await send('/refresh',{sourceKeys:['livebench-coding'],reason:'test'})).statusCode,401);
  config.environmentName = 'development';
  config.devAdmin = {displayName:'Leaderboard test'};
  assert.equal((await app.inject({method:'POST',url:path+'/refresh',payload:{sourceKeys:['livebench-coding'],reason:'test'}})).statusCode,403);
  const overview=await app.inject(path);
  assert.equal(overview.statusCode,200);
  assert.equal(overview.headers['cache-control'],'no-store');
  assert.equal(overview.json().sources.length,69);
  assert.equal(overview.json().sources.filter((s:{supported:boolean})=>s.supported).length,24);
});

test('refresh is refused while disabled, and enqueueing never collects in the request',async()=>{
  process.env.COLLECT_ENABLED='false'; process.env.LEADERBOARD_REFRESH_ENABLED='true';
  assert.equal((await send('/refresh',{sourceKeys:['livebench-coding'],reason:'fixture'})).statusCode,409);
  process.env.COLLECT_ENABLED='true';
  try {
    assert.equal((await send('/refresh',{sourceKeys:['invented-source'],reason:'fixture'})).statusCode,400);
    const one=await send('/refresh',{sourceKeys:['livebench-coding'],reason:'fixture'});
    assert.equal(one.statusCode,202);
    assert.ok(one.json().jobId);
    const two=await send('/refresh',{sourceKeys:['livebench-coding'],reason:'fixture duplicate'});
    assert.equal(two.statusCode,202);
    const jobs=await sql`SELECT data FROM pgboss.job WHERE name='model-leaderboard.operations' AND state='created'`;
    assert.equal(jobs.length,1,'the singleton prevents duplicate pending refreshes');
    assert.equal((await sql`SELECT count(*)::int AS n FROM lb_snapshots`)[0]!.n,0,'request only enqueues');
    assert.deepEqual(jobs[0]!.data.sourceKeys,['livebench-coding']);
    process.env.COLLECT_ENABLED='false';
    const { leaderboardQueue }=await import('../backend/admin.ts');
    await assert.rejects(leaderboardQueue.run(jobs[0]!.data),/关闭|disabled/,'worker rechecks the valve');
  } finally {process.env.COLLECT_ENABLED='false';process.env.LEADERBOARD_REFRESH_ENABLED='false';}
});

test('manual metadata requires real dates and sources and is audited without changing rankings',async()=>{
  await sql`INSERT INTO lb_models(id,slug,name) VALUES('admin-model','admin-model','Admin model')`;
  const price={currency:'USD',input:0,output:4,cached:null,sourceUrl:'https://example.org/pricing',asOf:'2026-09-30',note:null,reason:'checked official source'};
  assert.equal((await send('/models/admin-model/price',{...price,input:-1})).statusCode,400);
  assert.equal((await send('/models/admin-model/price',{...price,sourceUrl:'javascript:alert(1)'})).statusCode,400);
  assert.equal((await send('/models/admin-model/price',price)).statusCode,200);
  const context={tokens:128000,sourceUrl:'https://example.org/model',asOf:'2026-09-29',reason:'official specification'};
  assert.equal((await send('/models/admin-model/context',context)).statusCode,200);
  const fx={asOf:'2026-09-30',rate:7,sourceName:'Fixture central bank',sourceUrl:'https://example.org/fx',reason:'dated quote'};
  assert.equal((await send('/fx',{...fx,rate:0})).statusCode,400);
  assert.equal((await send('/fx',fx)).statusCode,200);
  const models=await app.inject(path+'/models?q=admin-model');
  assert.equal(models.json().rows[0].price.asOf,'2026-09-30');
  assert.equal(models.json().rows[0].price.origin,'manual');
  assert.equal(models.json().rows[0].context.tokens,128000);
  assert.equal(models.json().rows[0].context.verifiedAt,'2026-09-29T00:00:00.000Z');
  assert.equal((await sql`SELECT count(*)::int AS n FROM audit_log WHERE action LIKE 'leaderboard.%' AND subject='leaderboard:model:admin-model'`)[0]!.n,2);
  assert.equal((await sql`SELECT count(*)::int AS n FROM lb_rankings`)[0]!.n,0);
});

test('review publishes only a complete eligible shadow run and records the reviewer',async()=>{
  const keys=['overall','coding','reasoning','knowledge','professional'];
  const models=[...ANCHORS].slice(0,10);
  const summary={consensus:{input:keys.map(board=>({board,models,registry:{},signals:[]})),boards:keys.map(board=>({board,solver:{optimal:true},scoring:{optimal:true},publishable_connectivity:true})),evidence:{}},timings:[]};
  await sql`INSERT INTO lb_runs(id,methodology_version,generated_at,status,summary) VALUES
    ('admin-shadow',${METHOD_VERSION},now(),'shadow',${sql.json(summary)}),
    ('admin-failed',${METHOD_VERSION},now(),'failed',${sql.json(summary)}),
    ('admin-incomplete',${METHOD_VERSION},now(),'shadow','{}')`;
  for(const [i,slug] of models.entries()) {
    await sql`INSERT INTO lb_models(id,slug,name) VALUES(${slug},${slug},${slug}) ON CONFLICT DO NOTHING`;
    for(const board of keys) await sql`INSERT INTO lb_rankings(run_id,board,model_id,rank,score) VALUES('admin-shadow',${board},${slug},${i+1},${90-i})`;
  }
  invalidateLeaderboard();
  assert.equal((await app.inject('/api/v1/leaderboard/boards/overall')).statusCode,503);
  assert.equal((await send('/runs/admin-failed/publish',{reason:'review'})).statusCode,409);
  assert.equal((await send('/runs/admin-incomplete/publish',{reason:'review'})).statusCode,409);
  const preview=await app.inject(path+'/runs/admin-shadow');
  assert.equal(preview.statusCode,200);
  assert.equal(preview.json().rankings.length,50);
  assert.equal((await send('/runs/admin-shadow/publish',{reason:'reviewed raw sources and publication conditions'})).statusCode,200);
  assert.equal((await app.inject('/api/v1/leaderboard/boards/overall')).json().run.id,'admin-shadow');
  assert.equal((await sql`SELECT count(*)::int AS n FROM audit_log WHERE action='leaderboard.publish' AND subject='leaderboard:run:admin-shadow'`)[0]!.n,1);
});
