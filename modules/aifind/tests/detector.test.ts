import '../../../tests/setup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from '@aihot/backend/db';
import {createMonitor,readMonitor} from '../detector/monitors.ts';
import {recordObservation,readObservation} from '../detector/observations.ts';
import {processObservation} from '../detector/detect.ts';
import {createCandidate,readCandidate,reviewCandidate} from '../changes/candidates.ts';
import {applyCandidate} from '../changes/apply.ts';
import {getPublishedProductBySlug} from '../publication/products.ts';
import {clonePublishedProduct} from '../catalog/versions.ts';
import {setProductLanguageSupport} from '../catalog/facts.ts';
import {publishProductVersion} from '../catalog/publish.ts';
import {readAdminProduct} from '../admin/read.ts';
import {publishedFixture,actor,reason} from './admin-fixtures.ts';
test.after(()=>sql.end());

const semantics={languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'partial'};
const text=JSON.stringify(semantics);
const output={changes:[{candidateType:'language',targetKey:'ja',proposedValue:semantics,evidenceQuote:text,evidenceLocator:{start:0,end:text.length}}],unsupportedObservations:[],notes:[]};
async function observed() {
  const f=await publishedFixture();
  const m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/product',sourceKind:'official_support',publisher:'Synthetic',reason},actor);
  const o=await recordObservation(m,{text,httpStatus:200,fetchOutcome:'ok',retrievedAt:'2026-10-05T03:00:00Z'});
  return {...f,m,o};
}
const adapter=async()=>({output,receiptId:null});
test('K01-K06 Evidence-first detector starts detected, promotes only validated pending, and cannot edit or publish Domain',async()=>{
  const f=await observed();const result=await processObservation(f.o.id,{adapter});
  assert.equal(result.state,'detected');assert.equal(result.candidateIds.length,1);
  const d=await readCandidate(result.candidateIds[0]);
  assert.equal(d.candidate.sourceType,'detector');assert.equal(d.candidate.status,'pending_review');
  assert.equal(d.candidate.proposedValue.verifiedAt,null);assert.equal(d.evidence.retrievedAt,'2026-10-05T03:00:00.000Z');
  assert.equal(d.candidate.detector?.observationId,f.o.id);
  assert.equal((await readAdminProduct(f.product.id)).draft,null);
  assert.equal((await getPublishedProductBySlug(f.product.slug))!.languages[0].outputSupport,'partial');
  await assert.rejects(()=>applyCandidate(d.candidate.id,{reason},'detector-worker'));
  await assert.rejects(()=>createCandidate({...output.changes[0],productId:f.product.id,baseVersionId:f.published.version.id,evidenceId:d.evidence.id,sourceType:'detector',reason},actor));
  const [history]=await sql`SELECT count(*)::int AS n FROM audit_log WHERE action='aifind.candidate.detected' AND subject=${'aifind:candidate:'+d.candidate.id}`;
  assert.equal(history.n,1);
});
test('K07-K10 / X03 concurrent and ten repeated runs create one immutable Candidate and Evidence',async()=>{
  const f=await observed();
  const runs=await Promise.all([processObservation(f.o.id,{adapter}),processObservation(f.o.id,{adapter})]);
  for(let i=0;i<10;i++)await processObservation(f.o.id,{adapter});
  assert.equal(runs[0].candidateIds[0],runs[1].candidateIds[0]);
  const rows=await sql`SELECT * FROM af_product_change_candidates WHERE product_id=${f.product.id}`;assert.equal(rows.length,1);
  assert.equal((await sql`SELECT * FROM af_evidence WHERE observation_id=${f.o.id}`).length,1);
  await assert.rejects(()=>sql`UPDATE af_product_change_candidates SET proposed_value='{}'::jsonb WHERE id=${rows[0].id}`,/immutable/);
  await assert.rejects(()=>sql`DELETE FROM af_product_change_candidates WHERE id=${rows[0].id}`,/history/);
  await assert.rejects(()=>sql`INSERT INTO af_product_change_candidates(id,product_id,base_version_id,candidate_type,target_key,proposed_value,evidence_id,source_type,status,observation_id,source_url,resolver_method,resolver_version,detector_version,prompt_version,proposal_key)
    SELECT 'forged-status',product_id,base_version_id,candidate_type,target_key,proposed_value,evidence_id,source_type,'pending_review',observation_id,source_url,resolver_method,resolver_version,detector_version,prompt_version,repeat('a',64) FROM af_product_change_candidates WHERE id=${rows[0].id}`,/starts detected/);
});
test('T01-T05 / X04-X05 Human approve time is applied to Draft; Published and public freshness remain V1 until separate Publish',async()=>{
  const f=await observed(),result=await processObservation(f.o.id,{adapter}),id=result.candidateIds[0];
  const approvals=await Promise.allSettled([reviewCandidate(id,'approve',{reason},actor),reviewCandidate(id,'approve',{reason},actor)]);
  assert.equal(approvals.filter(r=>r.status==='fulfilled').length,1);
  const reviewed=(await readCandidate(id)).candidate;
  const applied=await applyCandidate(id,{reason},actor),again=await applyCandidate(id,{reason},actor);
  assert.equal(again.alreadyApplied,true);assert.equal(again.draftVersionId,applied.draftVersionId);
  const admin=await readAdminProduct(f.product.id);
  assert.equal(admin.draft!.languages[0].verifiedAt,reviewed.reviewedAt);
  assert.notEqual(admin.draft!.languages[0].verifiedAt,f.o.retrievedAt);
  assert.equal(admin.published!.version.id,f.published.version.id);assert.equal(admin.published!.languages[0].outputSupport,'partial');
  assert.equal((await getPublishedProductBySlug(f.product.slug))!.lastVerifiedAt,f.published.lastVerifiedAt);
  await publishProductVersion(f.product.id,applied.draftVersionId,actor,'Separate human publish simulation');
  assert.equal((await getPublishedProductBySlug(f.product.slug))!.languages[0].outputSupport,'full');
  assert.equal((await sql`SELECT * FROM audit_log WHERE action='aifind.candidate.apply' AND subject=${'aifind:candidate:'+id}`).length,1);
});
test('X01 Published changes during detector work: retain stale observation, create no pending Candidate',async()=>{
  const f=await observed();
  const result=await processObservation(f.o.id,{adapter:async()=>{
    const draft=await clonePublishedProduct(f.product.id,actor);await publishProductVersion(f.product.id,draft.version.id,actor,reason);return {output,receiptId:null};
  }});
  assert.equal(result.state,'stale');assert.equal(result.candidateIds.length,0);
  assert.equal((await sql`SELECT * FROM af_product_change_candidates WHERE product_id=${f.product.id}`).length,0);
});
test('X02 Draft conflict prevents Detector Apply from overwriting human work',async()=>{
  const f=await observed(),result=await processObservation(f.o.id,{adapter});
  await reviewCandidate(result.candidateIds[0],'approve',{reason},actor);
  const draft=await clonePublishedProduct(f.product.id,actor);
  await setProductLanguageSupport(f.product.id,draft.version.id,{...semantics,outputSupport:'none',evidenceId:f.proof.evidenceId,verifiedAt:f.proof.verifiedAt});
  await assert.rejects(()=>applyCandidate(result.candidateIds[0],{reason},actor),/Draft/);
  assert.equal((await readAdminProduct(f.product.id)).draft!.languages[0].outputSupport,'none');
});
test('D01-D02 / J06 unchanged hash skips adapter and preserves human verification; D12 fetch failures produce no facts',async()=>{
  const f=await observed();let calls=0;
  const next=await recordObservation(await readMonitor(f.m.id),{text,httpStatus:200,fetchOutcome:'ok'});
  assert.equal((await processObservation(next.id,{adapter:async()=>{calls++;return {output,receiptId:null};}})).state,'unchanged');
  assert.equal(calls,0);assert.equal((await getPublishedProductBySlug(f.product.slug))!.lastVerifiedAt,f.published.lastVerifiedAt);
  for(const status of [403,404]){
    const bad=await recordObservation(await readMonitor(f.m.id),{text:'JP unavailable',httpStatus:status,fetchOutcome:status===403?'blocked':'not_found'});
    assert.equal((await processObservation(bad.id,{adapter})).state,'fetch_failed');
  }
  assert.equal((await sql`SELECT * FROM af_product_change_candidates WHERE product_id=${f.product.id}`).length,0);
});
test('D03-D05 invalid quote/schema is recorded without Evidence or active proposals',async()=>{
  const f=await observed();
  const result=await processObservation(f.o.id,{adapter:async()=>({output:{...output,changes:[{...output.changes[0],evidenceQuote:'forged'}]},receiptId:null})});
  assert.equal(result.state,'invalid');assert.equal(result.candidateIds.length,0);
  assert.equal((await sql`SELECT * FROM af_evidence WHERE observation_id=${f.o.id}`).length,0);
  assert.equal((await readObservation(f.o.id)).state,'invalid');
});
test('K08 Evidence/Candidate/audit rollback is retry-safe after interruption',async()=>{
  const f=await observed();
  await sql.unsafe(`CREATE FUNCTION phase4_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='aifind.candidate.pending_review' THEN RAISE EXCEPTION 'synthetic interruption'; END IF; RETURN NEW; END; $$; CREATE TRIGGER phase4_fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION phase4_fail_audit();`);
  try { await assert.rejects(()=>processObservation(f.o.id,{adapter}),/synthetic interruption/); }
  finally { await sql.unsafe('DROP TRIGGER phase4_fail_audit ON audit_log; DROP FUNCTION phase4_fail_audit();'); }
  assert.equal((await sql`SELECT * FROM af_evidence WHERE observation_id=${f.o.id}`).length,0);
  const result=await processObservation(f.o.id,{adapter});assert.equal(result.candidateIds.length,1);
});
test('Japanese evidence with an emoji before the quote uses correct persisted character coordinates',async()=>{
  const f=await observed(),source='👋\n'+text;
  const o=await recordObservation(await readMonitor(f.m.id),{text:source,httpStatus:200,fetchOutcome:'ok'});
  const result=await processObservation(o.id,{adapter:async()=>({output:{...output,changes:[{...output.changes[0],evidenceLocator:{start:3,end:3+text.length}}]},receiptId:null})});
  assert.equal(result.candidateIds.length,1);assert.equal((await readCandidate(result.candidateIds[0])).detectorEvidence!.start,2);
});
test('A contradictory prose platform quote is retained as unsupported without Evidence or Candidate',async()=>{
  const f=await observed(),quote='Web application only; no iOS app.';
  const o=await recordObservation(await readMonitor(f.m.id),{text:quote,httpStatus:200,fetchOutcome:'ok'});
  const result=await processObservation(o.id,{adapter:async()=>({output:{changes:[{candidateType:'platform',targetKey:'ios',proposedValue:{platformKey:'ios',status:'available'},evidenceQuote:quote,evidenceLocator:{start:0,end:quote.length}}]},receiptId:null})});
  assert.equal(result.state,'no_changes');assert.equal(result.candidateIds.length,0);assert.equal(result.unsupported.length,1);
  assert.equal((await sql`SELECT * FROM af_evidence WHERE observation_id=${o.id}`).length,0);
  assert.equal((await sql`SELECT * FROM af_product_change_candidates WHERE product_id=${f.product.id}`).length,0);
});
