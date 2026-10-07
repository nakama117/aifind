import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {gate} from '../../../tests/setup.ts';
// Only this isolated test process may call its loopback transport; setup denies every external host.
process.env.ALLOW_PRIVATE_NETWORK_FETCH='true';process.env.COLLECT_ENABLED='true';process.env.MODEL_CALLS_ENABLED='false';
const {sql}=await import('@aihot/backend/db'),{publishedFixture,actor,reason}=await import('./admin-fixtures.ts');
const {createMonitor,updateMonitor}=await import('../detector/monitors.ts'),{reviewSourcePolicy}=await import('../detector/source-policy.ts');
const {fetchMonitor}=await import('../detector/fetch.ts'),{recordObservation,readObservation}=await import('../detector/observations.ts');
const {processObservation}=await import('../detector/detect.ts'),{pruneObservations}=await import('../detector/retention.ts');
after(()=>sql.end());
async function source(url:string,allowJina=false){const f=await publishedFixture(),m=await createMonitor({productId:f.product.id,url,sourceKind:'official_docs',publisher:'LOCAL TEST DOUBLE',allowJina,reason},actor);
 const p=await reviewSourcePolicy(m.id,{expectedRevision:m.revision,status:'approved',retentionClass:'evidence_only',excerptDays:30,allowAutomatedFetch:true,allowJina,reason},actor);return {f,m:await updateMonitor(m.id,{enabled:true,expectedRevision:p.revision,reason},actor)};}
async function transport(hold:'robots'|'page'){
 const entered=gate(),release=gate(),hits={robots:0,page:0,jina:0};
 const server=http.createServer(async(req,res)=>{if(req.url==='/robots.txt'){hits.robots++;if(hold==='robots'){entered.open();await release.promise;}res.writeHead(404);res.end();}
 else if(req.url==='/page'){hits.page++;if(hold==='page'){entered.open();await release.promise;}res.writeHead(200,{'content-type':'text/html'});res.end('<html><body></body></html>');}
 else{hits.jina++;res.writeHead(200,{'content-type':'text/plain'});res.end('Title: local fake\nMarkdown Content:\nLOCAL TEST ONLY');}});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+(server.address() as import('node:net').AddressInfo).port;
 return{origin,entered,release,hits,close:()=>new Promise<void>(r=>server.close(()=>r()))};
}
test('RF01 revoked policy during robots request prevents the subsequent source request',async()=>{
 const t=await transport('robots'),{m}=await source(t.origin+'/page');const fetching=fetchMonitor(m,randomUUID());
 try{await t.entered.promise;await reviewSourcePolicy(m.id,{expectedRevision:m.revision,status:'blocked',retentionClass:'evidence_only',excerptDays:30,allowAutomatedFetch:false,allowJina:false,reason},actor);t.release.open();const result=await fetching;
  assert.equal(t.hits.page,0);assert.equal(t.hits.jina,0);assert.equal(result.fetchOutcome,'error');assert.match(result.reason??'',/policy|承認|changed/i);
 }finally{t.release.open();await fetching;await t.close();}
});
test('RF02 revoked Jina permission during page request prevents the paid renderer call',async()=>{
 const t=await transport('page'),{m}=await source(t.origin+'/page',true);process.env.JINA_API_KEY='test-key';process.env.JINA_BASE_URL=t.origin+'/jina';const fetching=fetchMonitor(m,randomUUID());
 try{await t.entered.promise;await reviewSourcePolicy(m.id,{expectedRevision:m.revision,status:'approved',retentionClass:'evidence_only',excerptDays:30,allowAutomatedFetch:true,allowJina:false,reason},actor);t.release.open();const result=await fetching;
  assert.equal(t.hits.jina,0);assert.equal(result.fetchOutcome,'error');assert.match(result.reason??'',/policy|Jina|changed/i);
 }finally{t.release.open();await fetching;delete process.env.JINA_API_KEY;delete process.env.JINA_BASE_URL;await t.close();}
});
test('RF03 direct SQL cannot approve or block a source without nonblank reviewer and reason',async()=>{
 for(const status of ['approved','blocked'])for(const [reviewer,why] of [[null,reason],[actor,null],[' ',reason],[actor,' ']] as const){
  const m=await createMonitor({url:'https://synthetic.example/sql-review/'+randomUUID(),sourceKind:'official_docs',publisher:'LOCAL TEST DOUBLE',reason},actor);
  await assert.rejects(()=>sql`UPDATE af_source_monitors SET policy_status=${status},policy_reviewed_at=clock_timestamp(),policy_reviewed_by=${reviewer},policy_reason=${why},policy_fetch_allowed=${status==='approved'},enabled=${status==='approved'} WHERE id=${m.id}`,/af_source_review_identity/);
 }
});
const value={languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'partial'},quote=JSON.stringify(value);
const answer={changes:[{candidateType:'language',targetKey:'ja',proposedValue:value,evidenceQuote:quote,evidenceLocator:{start:0,end:quote.length}}],unsupportedObservations:[],notes:[]};
async function invalidObservation(){const {m}=await source('https://synthetic.example/retry/'+randomUUID()),o=await recordObservation(m,{text:quote,httpStatus:200,fetchOutcome:'ok'});await processObservation(o.id,{adapter:async()=>({output:{invalid:true},receiptId:null})});assert.equal((await readObservation(o.id)).state,'invalid');return o;}
test('RF04 retention and direct SQL cannot prune a retryable Observation while its adapter is in flight',async()=>{
 const o=await invalidObservation(),entered=gate(),release=gate();const running=processObservation(o.id,{adapter:async()=>{entered.open();await release.promise;return{output:answer,receiptId:null};}});
 try{await entered.promise;await pruneObservations(new Date('2027-10-02T00:00:00Z'));assert.equal((await readObservation(o.id)).text,quote);assert.equal((await readObservation(o.id)).prunedAt,null);
  await assert.rejects(()=>sql`UPDATE af_source_observations SET source_text='',pruned_at=clock_timestamp() WHERE id=${o.id}`,/immutable|processing|prun/i);
 }finally{release.open();await running;}
 const done=await readObservation(o.id);assert.equal(done.state,'detected');assert.equal(done.candidateIds.length,1);await pruneObservations();assert.equal((await readObservation(o.id)).text,'');
});
test('RF05 concurrent processing of one Observation executes only one adapter and preserves its result',async()=>{
 const o=await invalidObservation(),entered=gate(),release=gate();let calls=0;const adapter=async()=>{calls++;entered.open();await release.promise;return{output:answer,receiptId:null};};const first=processObservation(o.id,{adapter});await entered.promise;const second=processObservation(o.id,{adapter});
 try{await pruneObservations(new Date('2027-10-02T00:00:00Z'));}finally{release.open();await Promise.all([first,second]);}
 assert.equal(calls,1);const done=await readObservation(o.id);assert.equal(done.state,'detected');assert.equal(done.candidateIds.length,1);assert.ok(done.text);
});
function ownedDir(){const parent=path.resolve('.data','phase8-review-launch-'+randomUUID()),dataDir=path.join(parent,'runtime');fs.mkdirSync(dataDir,{recursive:true});return{parent,dataDir};}
test('RF06 Preview can restart from stopped receipts without overwriting password or historical run evidence',async()=>{
 const {prepareLaunchRun}=await import('../../../scripts/lib/aifind-launch-runtime.ts'),{parent,dataDir}=ownedDir();const first=prepareLaunchRun(dataDir,3980,'/aifind_restart_test_preview');
 first.record({launcher:2147483646,api:2147483645,web:2147483644,worker:2147483643});const old=fs.readFileSync(first.receiptFile),password=fs.readFileSync(first.passwordFile);
 const next=prepareLaunchRun(dataDir,3980,'/aifind_restart_test_preview');next.record({launcher:2147483642,api:2147483641,web:2147483640,worker:2147483639});assert.equal(next.password,first.password);assert.deepEqual(fs.readFileSync(first.passwordFile),password);assert.deepEqual(fs.readFileSync(first.receiptFile),old);assert.notEqual(next.receiptFile,first.receiptFile);assert.ok(fs.existsSync(path.join(parent,'launch-runtime.json')));
});
test('RF07 Preview refuses restart when a previous launch process is still alive',async()=>{
 const {prepareLaunchRun}=await import('../../../scripts/lib/aifind-launch-runtime.ts'),{dataDir}=ownedDir();const first=prepareLaunchRun(dataDir,3980,'/aifind_restart_test_preview');first.record({launcher:process.pid,api:null,web:null,worker:null});await assert.rejects(async()=>prepareLaunchRun(dataDir,3980,'/aifind_restart_test_preview'),/still running|停止/);
});
