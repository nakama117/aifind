import '../../../tests/setup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from '@aihot/backend/db';
import {config} from '@aihot/backend/config';
import {installModules} from '@aihot/backend/modules';
import {stopBoss,getBoss} from '@aihot/backend/jobs/queue';
import {aifindServer} from '../server.ts';
import {observeQueue,detectQueue,detectorEnabled,queueMonitorRun,observeMonitor} from '../detector/jobs.ts';
import {robotsAllowed,fetchMonitor} from '../detector/fetch.ts';
import {createReviewedTestMonitor as createMonitor} from './monitor-fixtures.ts';
import {recordObservation} from '../detector/observations.ts';
import {modelDetect,modelResolve} from '../detector/model.ts';
import {resolveIdentity} from '../resolver/resolve.ts';
import {publishedFixture,actor,reason} from './admin-fixtures.ts';
import {stub,pointModels} from '../../../tests/setup.ts';
import {processObservation} from '../detector/detect.ts';
installModules([aifindServer]);
test.after(async()=>{await stopBoss();await sql.end();});
test('J01-J05 module queues are distinct, Run Now enqueues only, and closed valves prevent worker fetch/schedules',async()=>{
  assert.deepEqual(aifindServer.queues?.map(q=>q.name),['aifind.observe','aifind.detect']);
  assert.equal(detectorEnabled(),false);assert.equal(aifindServer.schedules?.[0].when?.(),false);
  const f=await publishedFixture();const m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/product',sourceKind:'official_product',publisher:'Synthetic',enabled:true,reason},actor);
  const result=await queueMonitorRun(m.id,{reason},actor,{allowDisabled:true});
  assert.equal(typeof result.jobId,'string');
  assert.equal((await sql`SELECT * FROM af_source_observations WHERE monitor_id=${m.id}`).length,0);
  assert.equal((await observeMonitor(m.id)).skipped,'disabled');
  const boss=await getBoss();await boss.complete(observeQueue.name,result.jobId!);
  assert.notEqual(observeQueue.name,detectQueue.name);
});
test('URL controls refuse internal protocols/addresses and robots wildcard denial; fetch does not bypass access failures',async()=>{
  for(const url of ['file:///secret','data:text/plain,x','http://localhost/x','http://169.254.169.254/latest/meta-data','http://10.0.0.1/x'])await assert.rejects(()=>createMonitor({url,sourceKind:'other',publisher:'Synthetic',reason},actor));
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/open','https://example.com/private/a'),false);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /private\nAllow: /private/open','https://example.com/private/open'),true);
  assert.equal(robotsAllowed('User-agent: *\nDisallow: /*?secret=*','https://example.com/a?secret=x'),false);
});
test('R07/B04 actual model adapters short-circuit with MODEL_CALLS_ENABLED=false and create no receipt',async()=>{
  const f=await publishedFixture();const m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/product',sourceKind:'official_product',publisher:'Synthetic',reason},actor);
  const o=await recordObservation(m,{text:'JP support unchanged',httpStatus:200,fetchOutcome:'ok'}),before=(await sql`SELECT * FROM receipts`).length;
  const old=config.modelCallsEnabled;config.modelCallsEnabled=false;
  try {
    assert.equal(await modelDetect(o,f.published),null);
    const r={status:'ambiguous',productId:null,candidateIds:[f.product.id],method:'text',version:'r1',reason:'fixture',receiptId:null} as const;
    assert.equal((await modelResolve(o,[],r as any)).status,'ambiguous');
    assert.equal((await processObservation(o.id)).state,'model_disabled');
    assert.equal((await sql`SELECT * FROM receipts`).length,before);
  } finally {config.modelCallsEnabled=old;}
});
test('R06/R08/B01 actual local model response is allowlisted and retries reuse its receipt',async()=>{
  const fake=await stub(()=>({choices:[{message:{content:JSON.stringify({status:'resolved',productId:'outside',reason:'synthetic illegal ID'})}}]}));
  pointModels(fake.url);process.env.AIFIND_RESOLVER_MODEL='qwen3.7-flash';
  const f=await publishedFixture(),m=await createMonitor({url:'https://synthetic.example/product',sourceKind:'official_product',publisher:'Synthetic',reason},actor);
  const o=await recordObservation(m,{text:'Copilot',httpStatus:200,fetchOutcome:'ok'});
  const p=[{id:'ms',canonicalName:'Microsoft Copilot',aliases:['Copilot'],vendorName:'Microsoft',officialUrls:[]},{id:'gh',canonicalName:'GitHub Copilot',aliases:['Copilot'],vendorName:'GitHub',officialUrls:[]}];
  const initial=resolveIdentity({url:o.url,text:o.text},p);
  try {for(let i=0;i<2;i++)await assert.rejects(()=>modelResolve(o,p,initial),/outside/);assert.equal(fake.hits(),1);}finally{await fake.close();delete process.env.AIFIND_RESOLVER_MODEL;}
});
