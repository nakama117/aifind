import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {sql} from '@aihot/backend/db';
import {publishedFixture,actor,reason} from './admin-fixtures.ts';
import {createMonitor,readMonitor,updateMonitor} from '../detector/monitors.ts';
import {recordObservation,readObservation} from '../detector/observations.ts';
import {processObservation} from '../detector/detect.ts';
import {readCandidate} from '../changes/candidates.ts';
import {getPublishedProductBySlug} from '../publication/products.ts';
import {observeMonitor} from '../detector/jobs.ts';
after(()=>sql.end());
const policy=()=>import('../detector/source-policy.ts');
const retention=()=>import('../detector/retention.ts');
const semantic={languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'partial'},quote=JSON.stringify(semantic);
async function source(status='approved',retentionClass='evidence_only',excerptDays=30){
  const f=await publishedFixture(),m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/phase8-retention',sourceKind:'official_support',publisher:'Synthetic local test double',reason},actor);
  const reviewed=await (await policy()).reviewSourcePolicy(m.id,{expectedRevision:m.revision,status,retentionClass,excerptDays,allowAutomatedFetch:status==='approved',allowJina:false,reason},actor);
  return{f,m:reviewed};
}
async function observed(retentionClass='evidence_only'){
  const {f,m}=await source('approved',retentionClass),prefix='前の文 🗾\n',text=prefix+quote+'\n後の文';
  const o=await recordObservation(m,{text,httpStatus:200,fetchOutcome:'ok',retrievedAt:'2026-09-01T00:00:00Z'});
  const r=await processObservation(o.id,{adapter:async()=>({output:{changes:[{candidateType:'language',targetKey:'ja',proposedValue:semantic,evidenceQuote:quote,evidenceLocator:{start:prefix.length,end:prefix.length+quote.length}}],unsupportedObservations:[],notes:[]},receiptId:null})});
  return{f,m,o,r};
}
test('RET01 unreviewed source cannot enable a Monitor in Domain or direct SQL',async()=>{
  const m=await createMonitor({url:'https://synthetic.example/unreviewed',sourceKind:'official_docs',publisher:'Local test',reason},actor);
  await assert.rejects(()=>updateMonitor(m.id,{enabled:true,expectedRevision:m.revision,reason},actor),/policy|承認|approved/i);
  await assert.rejects(()=>sql`UPDATE af_source_monitors SET enabled=true WHERE id=${m.id}`,/policy|approved/i);
});
test('RET02 blocked source cannot enable even when fetch permission is requested',async()=>{
  const {m}=await source('blocked');await assert.rejects(()=>updateMonitor(m.id,{enabled:true,expectedRevision:m.revision,reason},actor),/policy|承認|approved/i);
});
test('RET03 explicitly approved source with automated permission can enable',async()=>{
  const {m}=await source(),enabled=await updateMonitor(m.id,{enabled:true,expectedRevision:m.revision,reason},actor);assert.equal(enabled.enabled,true);assert.equal(enabled.sourcePolicy.status,'approved');
});
test('RET04 evidence_only prunes completed input without waiting thirty days',async()=>{
  const {o}=await observed();await (await retention()).pruneObservations(new Date('2026-09-01T00:01:00Z'));const p=await readObservation(o.id);assert.equal(p.text,'');assert.equal(p.prunedAt,'2026-09-01T00:01:00.000Z');assert.equal(p.fetchOutcome,'ok');assert.equal(p.state,'detected');
});
test('RET05 short_excerpt keeps processed text strictly before its configured deadline',async()=>{
  const {o}=await observed('short_excerpt');await (await retention()).pruneObservations(new Date('2026-09-30T23:59:59Z'));assert.equal((await readObservation(o.id)).text,o.text);
});
test('RET06 short_excerpt prunes at the configured deadline',async()=>{
  const {o}=await observed('short_excerpt');await (await retention()).pruneObservations(new Date('2026-10-01T00:00:00Z'));assert.equal((await readObservation(o.id)).text,'');
});
test('RET07 pruning preserves full-source contentHash, inputHash, retrieval and fetch metadata',async()=>{
  const {o}=await observed();await (await retention()).pruneObservations(new Date('2026-10-02T00:00:00Z'));const p=await readObservation(o.id);
  for(const key of ['contentHash','inputHash','retrievedAt','publishedAt','fetchOutcome','httpStatus','url','monitorRevision'] as const)assert.equal(p[key],o[key],key);
});
test('RET08 Unicode Evidence quote/context/original locator survive pruning unchanged',async()=>{
  const {o,r}=await observed(),before=await readCandidate(r.candidateIds[0]);await (await retention()).pruneObservations(new Date('2026-10-02T00:00:00Z'));const after=await readCandidate(r.candidateIds[0]);
  assert.equal(after.detectorEvidence!.quote,quote);assert.equal(after.detectorEvidence!.contextBefore,'前の文 🗾\n');assert.equal(after.detectorEvidence!.contextAfter,'\n後の文');assert.equal(after.detectorEvidence!.start,6);assert.deepEqual(after.detectorEvidence,before.detectorEvidence);assert.equal(after.evidence.contentHash,o.contentHash);
});
test('RET09 pending Candidate review remains readable after raw text disappears',async()=>{
  const {r}=await observed();await (await retention()).pruneObservations(new Date('2026-10-02T00:00:00Z'));const d=await readCandidate(r.candidateIds[0]);assert.equal(d.candidate.status,'pending_review');assert.equal(d.detectorEvidence!.quote,quote);assert.ok(d.detectorEvidence!.retainedInputHash?.match(/^[a-f0-9]{64}$/));
});
test('RET10 retention never changes Published Product facts or Candidate proposal',async()=>{
  const {f,r}=await observed(),published=await getPublishedProductBySlug(f.product.slug),candidate=(await readCandidate(r.candidateIds[0])).candidate;
  await (await retention()).pruneObservations(new Date('2026-10-02T00:00:00Z'));assert.deepEqual(await getPublishedProductBySlug(f.product.slug),published);assert.deepEqual((await readCandidate(r.candidateIds[0])).candidate,candidate);
});
test('RET11 repeat retention is idempotent and preserves its first prune timestamp',async()=>{
  const {o}=await observed();await (await retention()).pruneObservations(new Date('2026-10-02T00:00:00Z'));const p=await readObservation(o.id);await (await retention()).pruneObservations(new Date('2026-11-02T00:00:00Z'));assert.deepEqual(await readObservation(o.id),p);
});
test('RET12 one-way pruning never opens ordinary history mutation or resurrection',async()=>{
  const {o,r}=await observed();await (await retention()).pruneObservations(new Date('2026-10-02T00:00:00Z'));
  await assert.rejects(()=>sql`UPDATE af_source_observations SET source_text='forged',pruned_at=NULL WHERE id=${o.id}`,/immutable/);
  await assert.rejects(()=>sql`UPDATE af_source_observations SET content_hash=${'a'.repeat(64)} WHERE id=${o.id}`,/immutable/);
  await assert.rejects(()=>sql`DELETE FROM af_source_observations WHERE id=${o.id}`,/history/);
  const detail=await readCandidate(r.candidateIds[0]);await assert.rejects(()=>sql`UPDATE af_observation_evidence_context SET context_before='forged' WHERE evidence_id=${detail.evidence.id}`,/immutable/);
});
test('RET13 unfinished observation is not pruned while processing needs its input',async()=>{
  const {m}=await source(),o=await recordObservation(m,{text:quote,httpStatus:200,fetchOutcome:'ok'});await (await retention()).pruneObservations(new Date('2027-10-02T00:00:00Z'));assert.equal((await readObservation(o.id)).text,quote);
});
test('RET14 changing source URL revokes review and disables the Monitor atomically',async()=>{
  const {m}=await source(),enabled=await updateMonitor(m.id,{enabled:true,expectedRevision:m.revision,reason},actor),edited=await updateMonitor(m.id,{url:'https://synthetic.example/other-policy',expectedRevision:enabled.revision,reason},actor);
  assert.equal(edited.enabled,false);assert.equal(edited.sourcePolicy.status,'unreviewed');assert.equal(edited.sourcePolicy.allowAutomatedFetch,false);
});
test('RET15 policy revocation prevents a queued real fetch and does not call transport',async()=>{
  const {m}=await source(),enabled=await updateMonitor(m.id,{enabled:true,expectedRevision:m.revision,reason},actor);
  const revoked=await (await policy()).reviewSourcePolicy(m.id,{expectedRevision:enabled.revision,status:'blocked',retentionClass:'evidence_only',excerptDays:30,allowAutomatedFetch:false,allowJina:false,reason},actor);
  const p=await policy();assert.equal(revoked.enabled,false);assert.throws(()=>p.assertMonitorPolicy(revoked));
  const old={collect:process.env.COLLECT_ENABLED,detector:process.env.AIFIND_DETECTOR_ENABLED};process.env.COLLECT_ENABLED='true';process.env.AIFIND_DETECTOR_ENABLED='true';
  try{assert.equal((await observeMonitor(m.id)).skipped,'monitor_disabled');assert.equal((await sql`SELECT id FROM af_source_observations WHERE monitor_id=${m.id}`).length,0);}
  finally{for(const [key,value] of [['COLLECT_ENABLED',old.collect],['AIFIND_DETECTOR_ENABLED',old.detector]] as const)if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
