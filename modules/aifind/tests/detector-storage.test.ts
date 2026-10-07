import '../../../tests/setup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sql} from '@aihot/backend/db';
import {createMonitor,updateMonitor,readMonitor} from '../detector/monitors.ts';
import {recordObservation,readObservation} from '../detector/observations.ts';
import {reviewSourcePolicy} from '../detector/source-policy.ts';
import {createReviewedTestMonitor} from './monitor-fixtures.ts';
import {publishedFixture,actor,reason} from './admin-fixtures.ts';
test.after(()=>sql.end());
test('Monitor registration defaults disabled, audits changes and rejects stale edits',async()=>{
  const f=await publishedFixture();
  const m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/pricing',sourceKind:'official_pricing',publisher:'Synthetic',reason},actor);
  assert.equal(m.enabled,false); assert.equal(m.revision,1);
  const reviewed=await reviewSourcePolicy(m.id,{expectedRevision:1,status:'approved',retentionClass:'evidence_only',excerptDays:30,allowAutomatedFetch:true,allowJina:false,reason},actor);
  const changed=await updateMonitor(m.id,{enabled:true,expectedRevision:reviewed.revision,reason},actor);
  assert.equal(changed.revision,3);assert.equal(changed.enabled,true);
  await assert.rejects(()=>updateMonitor(m.id,{enabled:false,expectedRevision:1,reason},actor));
  assert.equal((await sql`SELECT * FROM audit_log WHERE subject=${'aifind:monitor:'+m.id}`).length,2);
});
test('Observation input is immutable, content hashes detect unchanged runs, and fetch errors cannot become negative facts',async()=>{
  const f=await publishedFixture();
  const m=await createMonitor({productId:f.product.id,url:'https://synthetic.example/product',sourceKind:'official_product',publisher:'Synthetic',reason},actor);
  const o=await recordObservation(m,{text:'Synthetic product JP full',httpStatus:200,fetchOutcome:'ok'});
  const next=await recordObservation(await readMonitor(m.id),{text:'Synthetic product JP full',httpStatus:200,fetchOutcome:'ok'});
  assert.equal(next.state,'unchanged');assert.equal(next.contentHash,o.contentHash);
  await assert.rejects(()=>sql`UPDATE af_source_observations SET source_text='forged' WHERE id=${o.id}`,/immutable/);
  await assert.rejects(()=>sql`DELETE FROM af_source_observations WHERE id=${o.id}`,/history/);
  const bad=await recordObservation(await readMonitor(m.id),{text:'',httpStatus:403,fetchOutcome:'blocked',reason:'access denied'});
  assert.equal(bad.state,'fetch_failed');assert.equal(bad.contentHash,null);
  assert.equal((await readObservation(o.id)).text,'Synthetic product JP full');
  assert.equal((await sql`SELECT * FROM af_product_change_candidates WHERE product_id=${f.product.id}`).length,0);
});
test('Changes outside the retained short excerpt still change the source content hash',async()=>{
  const m=await createMonitor({url:'https://synthetic.example/long',sourceKind:'official_docs',publisher:'Synthetic',reason},actor);
  const prefix='x'.repeat(12000);
  const a=await recordObservation(m,{text:prefix+' old',httpStatus:200,fetchOutcome:'ok'});
  const b=await recordObservation(await readMonitor(m.id),{text:prefix+' new',httpStatus:200,fetchOutcome:'ok'});
  assert.equal(a.text.length,12000);assert.equal(b.state,'observed');assert.notEqual(a.contentHash,b.contentHash);
});
test('A partial Monitor edit preserves omitted registration, transport and enabled fields',async()=>{
  const f=await publishedFixture();
  const m=await createReviewedTestMonitor({productId:f.product.id,url:'https://synthetic.example/partial',sourceKind:'official_support',publisher:'Synthetic',identityHint:'Synthetic product',vendorHint:'Synthetic vendor',cadenceMinutes:360,allowJina:true,enabled:true,reason},actor);
  const edited=await updateMonitor(m.id,{sourceKind:'official_docs',expectedRevision:m.revision,reason},actor);
  for(const key of ['productId','url','identityHint','vendorHint','cadenceMinutes','allowJina','enabled'] as const)assert.equal(edited[key],m[key],key);
  assert.equal(edited.revision,m.revision+1);
});
