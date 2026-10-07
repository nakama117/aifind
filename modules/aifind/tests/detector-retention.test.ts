import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sql} from '@aihot/backend/db';
import {publishedFixture,actor,reason} from './admin-fixtures.ts';
import {createMonitor,readMonitor} from '../detector/monitors.ts';
import {recordObservation} from '../detector/observations.ts';
import {processObservation} from '../detector/detect.ts';
after(()=>sql.end());
const semantics={languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'partial'},quote=JSON.stringify(semantics);
const output={changes:[{candidateType:'language',targetKey:'ja',proposedValue:semantics,evidenceQuote:quote,evidenceLocator:{start:0,end:quote.length}}],unsupportedObservations:[],notes:[]};
test('Phase 4 carryover B: unrelated text hash changes still produce two active semantically identical Candidates (characterization)',async()=>{
  const f=await publishedFixture(),m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/retention',publisher:'Synthetic',sourceKind:'official_support',reason},actor);
  const a=await recordObservation(m,{text:quote+'\nFooter A',httpStatus:200,fetchOutcome:'ok'}),ra=await processObservation(a.id,{adapter:async()=>({output,receiptId:null})});
  const b=await recordObservation(await readMonitor(m.id),{text:quote+'\nFooter B',httpStatus:200,fetchOutcome:'ok'}),rb=await processObservation(b.id,{adapter:async()=>({output,receiptId:null})});
  // Historical test name stays in the accepted baseline; Phase 8 intentionally supersedes its duplicate behavior.
  assert.notEqual(a.contentHash,b.contentHash);assert.equal(ra.candidateIds[0],rb.candidateIds[0]);
  const candidates=await sql`SELECT status,proposed_value,proposal_key FROM af_product_change_candidates WHERE product_id=${f.product.id}`;
  assert.equal(candidates.length,1);assert.ok(candidates.every(c=>c.status==='pending_review'));
  for(const c of candidates){const {evidenceId,verifiedAt,...value}=c.proposed_value;assert.deepEqual(value,semantics);assert.equal(verifiedAt,null);assert.ok(evidenceId);}
  assert.equal((await sql`SELECT evidence_id FROM af_candidate_supporting_evidence WHERE candidate_id=${ra.candidateIds[0]}`).length,2);
  assert.equal((await sql`SELECT id FROM af_evidence WHERE observation_id IN ${sql([a.id,b.id])}`).length,2);
});
test('Phase 4 carryover A: 12k retained input, full-source hash and exact quote/locator remain immutable audit evidence',async()=>{
  const f=await publishedFixture(),m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/retention-long',publisher:'Synthetic',sourceKind:'official_support',reason},actor);
  const source=quote+'\n'+'x'.repeat(15000),o=await recordObservation(m,{text:source,httpStatus:200,fetchOutcome:'ok'});
  assert.equal(o.text.length,12000);assert.equal(o.contentHash,createHash('sha256').update(source).digest('hex'));assert.notEqual(o.contentHash,createHash('sha256').update(o.text).digest('hex'));
  const result=await processObservation(o.id,{adapter:async()=>({output,receiptId:null})});assert.equal(result.candidateIds.length,1);
  const [e]=await sql`SELECT evidence_quote,locator_start,locator_end FROM af_evidence WHERE observation_id=${o.id}`;
  assert.equal(Array.from(o.text).slice(e.locator_start,e.locator_end).join(''),e.evidence_quote);assert.equal(e.evidence_quote,quote);
  await assert.rejects(()=>sql`UPDATE af_source_observations SET source_text='' WHERE id=${o.id}`,/immutable/);
  await assert.rejects(()=>sql`DELETE FROM af_source_observations WHERE id=${o.id}`,/history/);
});
