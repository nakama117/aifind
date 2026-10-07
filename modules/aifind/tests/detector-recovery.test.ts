import '../../../tests/setup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {sql} from '@aihot/backend/db';
import {config} from '@aihot/backend/config';
import {installModules} from '@aihot/backend/modules';
import {getBoss,stopBoss} from '@aihot/backend/jobs/queue';
import {aifindServer} from '../server.ts';
import {observeQueue,detectQueue,queueMonitorRun} from '../detector/jobs.ts';
import {updateMonitor,readMonitor} from '../detector/monitors.ts';
import {createReviewedTestMonitor as createMonitor} from './monitor-fixtures.ts';
import {readObservation} from '../detector/observations.ts';
import {modelResolve} from '../detector/model.ts';
import {resolveIdentity} from '../resolver/resolve.ts';
import {publishedFixture,actor,reason} from './admin-fixtures.ts';
import {stub,pointModels} from '../../../tests/setup.ts';
installModules([aifindServer]);test.after(async()=>{await stopBoss();await sql.end();});

async function setup(){
  const f=await publishedFixture(),text=JSON.stringify({languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'partial'});
  const source=http.createServer((req,res)=>{res.setHeader('content-type','text/plain');res.end(req.url==='/robots.txt'?'User-agent: *\nAllow: /':text);});
  await new Promise<void>(r=>source.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+(source.address() as {port:number}).port;
  const old={private:config.allowPrivateNetworkFetch,model:config.modelCallsEnabled,collect:process.env.COLLECT_ENABLED,enabled:process.env.AIFIND_DETECTOR_ENABLED};
  config.allowPrivateNetworkFetch=true;process.env.COLLECT_ENABLED='true';process.env.AIFIND_DETECTOR_ENABLED='true';
  const m=await createMonitor({productId:f.product.id,url:url+'/source',sourceKind:'official_support',publisher:'Synthetic',enabled:true,reason},actor);
  const fake=await stub(()=>({choices:[{message:{content:JSON.stringify({changes:[{candidateType:'language',targetKey:'ja',proposedValue:JSON.parse(text),evidenceQuote:text,evidenceLocator:{start:0,end:text.length}}],unsupportedObservations:[],notes:[]})}}]}));
  pointModels(fake.url);process.env.AIFIND_DETECTOR_MODEL='qwen3.7-flash';
  return {...f,m,fake,close:async()=>{config.allowPrivateNetworkFetch=old.private;config.modelCallsEnabled=old.model;
    for(const [key,value] of [['COLLECT_ENABLED',old.collect],['AIFIND_DETECTOR_ENABLED',old.enabled]] as const)if(value===undefined)delete process.env[key];else process.env[key]=value;
    delete process.env.AIFIND_DETECTOR_MODEL;await fake.close();await new Promise<void>(r=>source.close(()=>r()));}};
}
async function observe(id:string){
  const queued=await queueMonitorRun(id,{reason},actor),boss=await getBoss();assert.ok(queued.jobId);
  const jobs=await boss.fetch<{monitorId:string;requestKey:string}>(observeQueue.name);assert.equal(jobs.length,1);
  const result=await observeQueue.run(jobs[0].data) as {observationId:string;state:string};await boss.complete(observeQueue.name,jobs[0].id);return result;
}
async function detect(){
  const boss=await getBoss(),jobs=await boss.fetch<{observationId:string}>(detectQueue.name);
  assert.equal(jobs.length,1,'unchanged source must resume the original incomplete Observation');
  const result=await detectQueue.run(jobs[0].data);await boss.complete(detectQueue.name,jobs[0].id);return result;
}
test('Real observe→queue chain resumes model-disabled input after enabling only the local fake model',async()=>{
  const f=await setup();try{
    config.modelCallsEnabled=false;const first=await observe(f.m.id);await detect();assert.equal((await readObservation(first.observationId)).state,'model_disabled');assert.equal(f.fake.hits(),0);
    config.modelCallsEnabled=true;assert.equal((await observe(f.m.id)).state,'unchanged');await detect();
    const recovered=await readObservation(first.observationId);assert.equal(recovered.state,'detected');assert.equal(recovered.candidateIds.length,1);assert.equal(f.fake.hits(),1);
    await observe(f.m.id);assert.equal((await(await getBoss()).fetch(detectQueue.name)).length,0);assert.equal(f.fake.hits(),1);
  }finally{await f.close();}
});
test('Real unchanged queue run resumes budget-blocked input and reuses its original Observation',async()=>{
  const f=await setup(),[budget]=await sql`SELECT * FROM budgets WHERE service='dashscope'`;try{
    config.modelCallsEnabled=true;await sql`UPDATE budgets SET per_minute=0 WHERE service='dashscope'`;
    const first=await observe(f.m.id);await detect();assert.equal((await readObservation(first.observationId)).state,'budget_blocked');assert.equal(f.fake.hits(),0);
    await sql`UPDATE budgets SET per_minute=${budget.per_minute} WHERE service='dashscope'`;
    await observe(f.m.id);await detect();assert.equal((await readObservation(first.observationId)).state,'detected');assert.equal(f.fake.hits(),1);
  }finally{await sql`UPDATE budgets SET per_minute=${budget.per_minute} WHERE service='dashscope'`;await f.close();}
});
test('A new Monitor revision observes identical text as a new input, preserving the old history',async()=>{
  const f=await setup();try{
    config.modelCallsEnabled=true;const first=await observe(f.m.id);await detect();
    const m=await readMonitor(f.m.id);await updateMonitor(m.id,{expectedRevision:m.revision,sourceKind:'official_docs',reason},actor);
    const next=await observe(f.m.id);assert.equal(next.state,'observed');await detect();
    const o=await readObservation(next.observationId),old=await readObservation(first.observationId);assert.notEqual(o.inputHash,old.inputHash);assert.equal(old.state,'detected');assert.equal(o.state,'detected');
    assert.equal((await sql`SELECT * FROM af_product_change_candidates WHERE product_id=${f.product.id}`).length,1,'stable proposal dedupe still applies across input revisions');
  }finally{await f.close();}
});
test('Optional model cannot choose through hard configured/source identity contradictions',async()=>{
  const fake=await stub(()=>({choices:[{message:{content:'{"status":"resolved","productId":"chat","reason":"incorrect override"}'}}]}));
  pointModels(fake.url);process.env.AIFIND_RESOLVER_MODEL='qwen3.7-flash';
  const products=[{id:'chat',canonicalName:'ChatGPT',aliases:[],vendorName:'OpenAI',officialUrls:[]},{id:'api',canonicalName:'OpenAI API',aliases:[],vendorName:'OpenAI',officialUrls:[]}];
  const initial=resolveIdentity({identity:'ChatGPT',registeredProductId:'chat',url:'https://synthetic.example/source',text:'OpenAI API pricing only'},products);
  try{const result=await modelResolve({text:'OpenAI API pricing only'} as any,products,initial);assert.equal(result.status,'ambiguous');assert.equal(fake.hits(),0);}finally{delete process.env.AIFIND_RESOLVER_MODEL;await fake.close();}
});
