import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDb, sql } from '@aihot/backend/db';
import { createEditorial, publishEditorial, createEditorialDraft, saveEditorialDraft, withdrawEditorial } from '../editorial/documents.ts';
import { clonePublishedProduct, getDraftProduct } from '../catalog/versions.ts';
import { saveProductPlan, saveProductPrice } from '../catalog/pricing.ts';
import { publishProductVersion } from '../catalog/publish.ts';
import { createCandidate, reviewCandidate } from '../changes/candidates.ts';
import { applyCandidate } from '../changes/apply.ts';
import { visibilityChange } from './public-fixtures.ts';
import { editorialContent, editorialActor as actor, editorialReason as reason } from './editorial-fixtures.ts';
const publication = await import('../publication/editorial.ts').catch(e => { if (e.code === 'ERR_MODULE_NOT_FOUND') return null; throw e; });
function publicReader() { assert.ok(publication, 'Editorial Published projection must exist'); return publication; }
const act = (d: {revision: number}) => ({ expectedRevision: d.revision, reason });
async function ready(type: 'comparison'|'category' = 'comparison', priced = false) {
  const f = await editorialContent(type, type === 'comparison' ? 2 : 3, priced ? async (f,p) => {
    const plan = await saveProductPlan(f.product.id, f.draft.version.id, { planKey:'pro', name:'[TEST] Pro', activeStatus:'active', ...p });
    await saveProductPrice(f.product.id, f.draft.version.id, plan.id, { priceType:'fixed',currencyCode:'JPY',amountMinor:2400,billingPeriod:'month',...p });
  } : undefined);
  const draft = await createEditorial({ content:f.content, reason }, actor), d = await publishEditorial(draft.id, act(draft), actor);
  return {...f, d};
}
after(closeDb);

test('C08/C09/SL01 public facts come from the current Published Product projection and reference metadata remains separate', async () => {
  const r=publicReader(),f=await ready('comparison',true),result=await r.resolvePublicEditorial('comparison',f.content.slug);
  assert.equal(result.kind,'found'); if(result.kind!=='found'||result.document.type!=='comparison')return;
  const p=result.document.products[0]; assert.equal(p.facts.plans[0].prices[0].amountMinor,2400); assert.equal(p.facts.versionNo,1);assert.equal(p.referenceVersionNo,1);
  assert.equal(result.document.needsRetest,false); assert.equal(result.document.comparison.verdictMd,'入力条件が合う場合に各候補を検討してください。');
  const columns=await sql`SELECT column_name FROM information_schema.columns WHERE table_name='af_comparison_products'`;
  assert.equal(columns.some(c=>c.column_name==='amount_minor'),false);
});
test('R01–R06/C10/C11 Product Publish updates dynamic facts, preserves V1 reference/verdict and computes needs_retest', async () => {
  const r=publicReader(),f=await ready('comparison',true),p=f.products[0];
  const draft=await clonePublishedProduct(p.product.id,actor),plan=draft.plans.find(p=>p.planKey==='pro')!;
  await saveProductPrice(p.product.id,draft.version.id,plan.id,{id:plan.prices[0].id,priceType:'fixed',amountMinor:2800,currencyCode:'JPY',billingPeriod:'month',...p.proof});
  let seen=await r.resolvePublicEditorial('comparison',f.content.slug);assert.equal(seen.kind,'found');if(seen.kind!=='found'||seen.document.type!=='comparison')return;
  assert.equal(seen.document.products[0].facts.plans[0].prices[0].amountMinor,2400);assert.equal(seen.document.needsRetest,false);
  await publishProductVersion(p.product.id,draft.version.id,actor,reason);
  seen=await r.resolvePublicEditorial('comparison',f.content.slug);assert.equal(seen.kind,'found');if(seen.kind!=='found'||seen.document.type!=='comparison')return;
  assert.equal(seen.document.products[0].facts.versionNo,2);assert.equal(seen.document.products[0].facts.plans[0].prices[0].amountMinor,2800);
  assert.equal(seen.document.products[0].referenceVersionNo,1);assert.equal(seen.document.needsRetest,true);
  assert.equal(seen.document.comparison.verdictMd,'入力条件が合う場合に各候補を検討してください。');assert.equal(seen.document.bodyMd,f.content.bodyMd);
});
test('R07/R08/R09 Candidate and Approved Apply-to-Draft do not change the public fact table or retest until Product Publish', async () => {
  const r=publicReader(),f=await ready(),p=f.products[0],before=await r.resolvePublicEditorial('comparison',f.content.slug);
  const c=await createCandidate({productId:p.product.id,baseVersionId:p.published.version.id,sourceType:'manual',candidateType:'market',targetKey:'JP',
    proposedValue:{marketCode:'JP',availabilityStatus:'available',...p.proof},evidenceId:p.proof.evidenceId,reason},actor);
  assert.deepEqual(await r.resolvePublicEditorial('comparison',f.content.slug),before);
  await reviewCandidate(c.id,'approve',{reason},actor);await applyCandidate(c.id,{reason},actor);
  assert.deepEqual(await r.resolvePublicEditorial('comparison',f.content.slug),before);
  const draft=await getDraftProduct(p.product.id);assert.ok(draft);
  await publishProductVersion(p.product.id,draft.version.id,actor,reason);
  const seen=await r.resolvePublicEditorial('comparison',f.content.slug);assert.equal(seen.kind,'found');if(seen.kind!=='found'||seen.document.type!=='comparison')return;
  assert.equal(seen.document.products[0].facts.markets[0].availabilityStatus,'available');assert.equal(seen.document.needsRetest,true);
});
for(const type of ['comparison','category'] as const)for(const visibility of ['private','unlisted'] as const)test(`Public isolation ${type}/${visibility} removes entire detail/directory/sitemap/related immediately`,async()=>{
  const r=publicReader(),f=await ready(type);assert.equal((await r.resolvePublicEditorial(type,f.content.slug)).kind,'found');
  assert.ok((await r.listPublicEditorial(type)).some(d=>d.slug===f.content.slug));
  await visibilityChange(f.products[0].product.id,visibility);
  assert.equal((await r.resolvePublicEditorial(type,f.content.slug)).kind,'not_found');assert.equal((await r.listPublicEditorial(type)).some(d=>d.slug===f.content.slug),false);
  assert.doesNotMatch(await r.editorialSitemapXml(),new RegExp(f.content.slug));
  const related=await r.listRelatedPublicEditorial(f.products[1].product.slug);assert.equal([...related.comparisons,...related.categories].some(d=>d.slug===f.content.slug),false);
});
test('E06/CAT10 editorial Draft and Test Record changes are absent from public DTO and directory',async()=>{
  const r=publicReader(),f=await ready(),before=await r.resolvePublicEditorial('comparison',f.content.slug),d=await createEditorialDraft(f.d.id,act(f.d),actor);
  if(f.content.type!=='comparison')return;
  f.content.title='SECRET EDITORIAL DRAFT';f.content.bodyMd='SECRET ADMIN NOTE';f.content.comparison.verdictMd='SECRET NEW VERDICT';
  f.content.comparison.products[0].testRecord={task:'SECRET TEST DRAFT',environmentMd:'private',procedureMd:'private',resultMd:'private',limitationsMd:'private',testedAt:'2026-10-06T00:00:00Z',reviewer:'SECRET REVIEWER',repeatCount:1,errorCriteria:null};
  await saveEditorialDraft(d.id,{...act(d),content:f.content},actor);
  assert.deepEqual(await r.resolvePublicEditorial('comparison',f.content.slug),before);
  assert.doesNotMatch(JSON.stringify(await r.listPublicEditorial('comparison')),/SECRET|"(?:reason|editor|audit|receipt|observation|candidate)":/);
});
test('SL02/SL03/SL05/SL06 old slugs go directly to current Published slug, Draft slug stays private and withdrawn redirects disappear',async()=>{
  const r=publicReader(),f=await ready(),old=f.content.slug;let d=await createEditorialDraft(f.d.id,act(f.d),actor);
  d=await saveEditorialDraft(d.id,{...act(d),content:{...f.content,slug:old+'-draft'}},actor);
  assert.equal((await r.resolvePublicEditorial('comparison',old+'-draft')).kind,'not_found');assert.equal((await r.resolvePublicEditorial('comparison',old)).kind,'found');
  d=await publishEditorial(d.id,act(d),actor);d=await createEditorialDraft(d.id,act(d),actor);
  d=await saveEditorialDraft(d.id,{...act(d),content:{...f.content,slug:old+'-current'}},actor);d=await publishEditorial(d.id,act(d),actor);
  assert.deepEqual(await r.resolvePublicEditorial('comparison',old),{kind:'redirect',slug:old+'-current'});assert.deepEqual(await r.resolvePublicEditorial('comparison',old+'-draft'),{kind:'redirect',slug:old+'-current'});
  await withdrawEditorial(d.id,act(d),actor);for(const slug of [old,old+'-draft',old+'-current'])assert.equal((await r.resolvePublicEditorial('comparison',slug)).kind,'not_found');
});
test('E09/CAT12 withdrawal removes public detail, directory, home-ready summaries, sitemap and Product related entries',async()=>{
  const r=publicReader(),f=await ready('category');assert.ok((await r.listRelatedPublicEditorial(f.products[0].product.slug)).categories.some(d=>d.slug===f.content.slug));
  await withdrawEditorial(f.d.id,act(f.d),actor);
  assert.equal((await r.resolvePublicEditorial('category',f.content.slug)).kind,'not_found');assert.equal((await r.listPublicEditorial('category')).some(d=>d.slug===f.content.slug),false);
  assert.equal((await r.listRelatedPublicEditorial(f.products[0].product.slug)).categories.some(d=>d.slug===f.content.slug),false);assert.doesNotMatch(await r.editorialSitemapXml(),new RegExp(f.content.slug));
});
test('CAT09 category recommendation stays authored when current Product version changes; no ranking or capability-generated pages',async()=>{
  const r=publicReader(),f=await ready('category'),p=f.products[0],draft=await clonePublishedProduct(p.product.id,actor);await publishProductVersion(p.product.id,draft.version.id,actor,reason);
  const found=await r.resolvePublicEditorial('category',f.content.slug);assert.equal(found.kind,'found');if(found.kind!=='found'||found.document.type!=='category')return;
  assert.equal(found.document.products[0].facts.versionNo,2);assert.equal(found.document.products[0].fitSummaryJa,'少量の公開資料を扱う場合。');assert.equal(found.document.productInfoUpdated,true);
  assert.equal('needsRetest' in found.document,false);assert.doesNotMatch(JSON.stringify(found.document),/winnerProductId|rank|score|AggregateRating/);
});
