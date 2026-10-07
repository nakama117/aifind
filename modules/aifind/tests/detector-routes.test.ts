import '../../../tests/setup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from '@aihot/backend/db';
import {config} from '@aihot/backend/config';
import {installModules} from '@aihot/backend/modules';
import {stopBoss,getBoss,workModuleQueues} from '@aihot/backend/jobs/queue';
import {aifindServer} from '../server.ts';
import {buildApp} from '../../../apps/api/src/app.ts';
import {seedDetectorPreview} from '../preview/detector-seed.ts';
import {readDetectorPreview} from '../preview/detector-service.ts';
import {assertPreviewWrites} from '../preview/config.ts';
import {actor,reason} from './admin-fixtures.ts';
import {clonePublishedProduct} from '../catalog/versions.ts';
import {publishProductVersion} from '../catalog/publish.ts';
installModules([aifindServer]);
config.devAdmin=null;config.adminPassword='synthetic-detector-password';
const app=await buildApp();
const login=await app.inject({method:'POST',url:'/api/auth/password',headers:{'content-type':'application/x-www-form-urlencoded'},payload:'password=synthetic-detector-password'});
const cookie=String(login.headers['set-cookie']).split(';')[0],csrf=(await app.inject({url:'/api/admin/me',headers:{cookie}})).json().csrf;
const headers={cookie,'x-csrf-token':csrf};
test.after(async()=>{await app.close();await stopBoss();await sql.end();});
test('Admin monitor/observation/Preview APIs deny anonymous, require CSRF, and expose noindex/no-store',async()=>{
  for(const [method,url] of [['GET','/monitors'],['POST','/monitors'],['PATCH','/monitors/missing'],['POST','/monitors/missing/run'],['GET','/observations/missing'],['GET','/preview/change-detector'],['POST','/preview/change-detector/run']] as const){
    const res=await app.inject({method,url:'/api/admin/aifind'+url,...(method==='GET'?{}:{payload:{}})});
    assert.equal(res.statusCode,401,url);assert.match(String(res.headers['x-robots-tag']),/noindex/);assert.match(String(res.headers['cache-control']),/no-store/);
    if(method!=='GET')assert.equal((await app.inject({method,url:'/api/admin/aifind'+url,headers:{cookie},payload:{}})).statusCode,403,url);
  }
});
test('Production/default Preview flag cannot seed products or run fixture actions',async()=>{
  delete process.env.AIFIND_PREVIEW_ENABLED;
  const before=(await sql`SELECT * FROM af_products`).length;
  await assert.rejects(()=>seedDetectorPreview(),/Preview requires/);
  assert.equal((await app.inject({url:'/api/admin/aifind/preview/change-detector',headers})).statusCode,404);
  assert.throws(()=>assertPreviewWrites({...process.env,AIFIND_PREVIEW_ENABLED:'true',NODE_ENV:'production'}),/production/);
  assert.equal((await sql`SELECT * FROM af_products`).length,before);
});
test('Preview routes enqueue a real pg-boss worker pipeline; existing review remains the only human Apply path',async()=>{
  process.env.AIFIND_PREVIEW_ENABLED='true';
  const seed=await seedDetectorPreview();assert.equal((await seedDetectorPreview()).products.main,seed.products.main);
  assert.equal((await sql`SELECT * FROM af_source_observations`).length,0);
  const queued=await app.inject({method:'POST',url:'/api/admin/aifind/preview/change-detector/run',headers,payload:{fixtureKey:'main',reason}});
  assert.equal(queued.statusCode,200,queued.body);
  assert.equal((await sql`SELECT * FROM af_source_observations`).length,0,'HTTP queues only; no inline observation/detection');
  await workModuleQueues(await getBoss());
  for(let i=0;i<150;i++){if((await sql`SELECT id FROM af_product_change_candidates WHERE product_id=${seed.products.main}`).length)break;await new Promise(r=>setTimeout(r,100));}
  const view=await readDetectorPreview();assert.ok(view);assert.equal(view.candidates.length,1);assert.equal(view.candidates[0].candidate.sourceType,'detector');
  const repeat=await app.inject({method:'POST',url:'/api/admin/aifind/preview/change-detector/run',headers,payload:{fixtureKey:'repeat_main',reason}});assert.equal(repeat.statusCode,200,repeat.body);
  assert.equal(repeat.json().observationId,view.candidates[0].candidate.detector!.observationId);
  for(let i=0;i<150;i++){const [job]=await sql`SELECT state FROM pgboss.job WHERE id=${repeat.json().jobId}`;if(job?.state==='completed')break;await new Promise(r=>setTimeout(r,100));}
  assert.equal((await sql`SELECT state FROM pgboss.job WHERE id=${repeat.json().jobId}`)[0].state,'completed');assert.equal((await readDetectorPreview())!.candidates.length,1);
  assert.equal(view.main.draft,null);assert.equal(view.main.published!.plans[0].prices[0].amountMinor,2400);
  const api=await app.inject({url:'/api/admin/aifind/preview/change-detector',headers});assert.equal(api.statusCode,200);assert.equal(api.json().candidates.length,1);
  const hub=await app.inject({url:'/api/admin/aifind/preview',headers});assert.ok(hub.json().previews.some((p:{path:string})=>p.path==='/admin/aifind/preview/change-detector'));
  const publicDetail=await app.inject({url:'/api/site/aifind/products/aifind-preview-detector-main'});
  assert.equal(publicDetail.statusCode,200,publicDetail.body);
  assert.doesNotMatch(publicDetail.body,/observationId|proposalKey|source_type|detectorVersion|model_receipt|evidenceQuote/);
  for(const path of ['/sitemap.xml','/sitemap-products.xml','/feed.xml','/llms.txt','/api/v1/items']){
    const result=await app.inject({url:path});assert.doesNotMatch(result.body,/admin\/aifind\/preview\/change-detector|observationId|detectorVersion/);
  }
  delete process.env.AIFIND_PREVIEW_ENABLED;
});
test('P06 Preview waits for an explicit Human Publish, then the real worker records stale with zero Candidate',async()=>{
  process.env.AIFIND_PREVIEW_ENABLED='true';
  try{
    const seed=await seedDetectorPreview(),before=await readDetectorPreview(),receipts=(await sql`SELECT id FROM receipts`).length;
    const queued=await app.inject({method:'POST',url:'/api/admin/aifind/preview/change-detector/run',headers,payload:{fixtureKey:'stale_commit',reason}});assert.equal(queued.statusCode,200,queued.body);
    let waiting:{observationId:string;baseVersionId:string}|undefined;
    for(let i=0;i<150;i++){const [row]=await sql`SELECT value FROM settings WHERE key='aifind.preview.phase4.stale_waiting'`;waiting=row?.value;if(waiting)break;await new Promise(r=>setTimeout(r,100));}
    assert.ok(waiting,'the worker must reach the controlled synthetic wait boundary');
    assert.equal((await readDetectorPreview())!.stale.published!.version.id,before!.stale.published!.version.id,'the waiting worker cannot publish');
    const draft=await clonePublishedProduct(seed.products.stale,'preview-human-fixture');await publishProductVersion(seed.products.stale,draft.version.id,'preview-human-fixture','[PREVIEW] Explicit Human Publish during detection');
    let view=await readDetectorPreview();for(let i=0;i<150;i++){view=await readDetectorPreview();if(view?.observations.find(o=>o.id===waiting!.observationId)?.state==='stale')break;await new Promise(r=>setTimeout(r,100));}
    const observation=view!.observations.find(o=>o.id===waiting!.observationId)!;assert.equal(observation.state,'stale');assert.deepEqual(observation.candidateIds,[]);
    assert.equal((await sql`SELECT id FROM af_product_change_candidates WHERE observation_id=${observation.id}`).length,0);assert.equal((await sql`SELECT id FROM af_evidence WHERE observation_id=${observation.id}`).length,0);
    assert.equal((await sql`SELECT id FROM receipts`).length,receipts);
  }finally{delete process.env.AIFIND_PREVIEW_ENABLED;}
});
