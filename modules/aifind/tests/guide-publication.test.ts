import '../../../tests/setup.ts';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { closeDb, sql } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { resolvePublicEditorial, listPublicEditorial, editorialSitemapXml, listRelatedPublicEditorial } from '../publication/editorial.ts';
import { resolvePublicProductBySlug } from '../publication/public-products.ts';
import { createEditorialDraft, saveEditorialDraft, restoreEditorial, withdrawEditorial } from '../editorial/documents.ts';
import { clonePublishedProduct, updateProductDraft } from '../catalog/versions.ts';
import { publishProductVersion } from '../catalog/publish.ts';
import { setProductMarket } from '../catalog/facts.ts';
import { proof } from './fixtures.ts';
import { visibilityChange } from './public-fixtures.ts';
import { uploadEditorialAsset, reviewEditorialAsset } from '../editorial/assets.ts';
import { guideFixture, guideTestRecord, createGuide, publishGuide, guideAction, guideActor, guideReason } from './guide-fixtures.ts';
after(closeDb);
const get=(slug:string)=>resolvePublicEditorial('guide',slug);
async function doc(slug:string){const r=await get(slug);assert.equal(r.kind,'found');if(r.kind!=='found'||r.document.type!=='guide')throw Error('Guide missing');return r.document;}
async function changed(f:Awaited<ReturnType<typeof guideFixture>>,index=0){
  const id=f.products[index].product.id,d=await clonePublishedProduct(id,guideActor);
  await updateProductDraft(id,d.version.id,{summaryJa:'新しい Published facts'});
  await setProductMarket(id,d.version.id,{marketCode:'JP',availabilityStatus:'unavailable',...await proof()});
  return publishProductVersion(id,d.version.id,guideActor,guideReason);
}
test('H12/H13 Guide Draft edits cannot affect Products and every public fact comes from the real reader',async()=>{
  const f=await guideFixture(),d=await createGuide(f.content), productBefore=await resolvePublicProductBySlug(f.products[0].product.slug);
  f.content.guide.stepsMd='SECRET DRAFT';
  await saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor);
  assert.deepEqual(await resolvePublicProductBySlug(f.products[0].product.slug),productBefore);
  assert.deepEqual(await get(f.content.slug),{kind:'not_found'});
  const p=await publishGuide(await (await import('../editorial/read.ts')).readEditorialAdmin(d.id)), guide=await doc(f.content.slug);
  assert.equal(guide.revisionNo,p.published!.revisionNo);assert.deepEqual(guide.products[0].facts,productBefore.kind==='found'?productBefore.product:null);
});
test('M02 official_sources public DTO shows its mode and never emits a Test Record or testedAt',async()=>{
  const f=await guideFixture();f.content.guide.products[0].testRecord=guideTestRecord(f.content.guide.products[0]);
  await publishGuide(await createGuide(f.content));const g=await doc(f.content.slug);
  assert.equal(g.guide.mode,'official_sources');assert.equal(g.products[0].testRecord,null);
  assert.equal(JSON.stringify(g).includes('testedAt'),false);
});
test('R01/R02 Product Draft and unpublished Guide Draft do not trigger needsRetest or leak changed facts',async()=>{
  const f=await guideFixture(),p=await publishGuide(await createGuide(f.content)), before=await doc(f.content.slug);
  const pd=await clonePublishedProduct(f.products[0].product.id,guideActor);await updateProductDraft(f.products[0].product.id,pd.version.id,{summaryJa:'SECRET PRODUCT DRAFT'});
  const d=await createEditorialDraft(p.id,guideAction(p),guideActor);f.content.guide.resultMd='SECRET GUIDE RESULT';await saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor);
  assert.deepEqual(await doc(f.content.slug),before);assert.equal(before.needsRetest,false);
});
test('R03/R04/R05 current primary Published change updates facts and needsRetest, preserving historical facts and authored steps',async()=>{
  const f=await guideFixture();f.content.guide.mode='hands_on';f.content.guide.products[0].testRecord=guideTestRecord(f.content.guide.products[0]);
  await publishGuide(await createGuide(f.content));const before=await doc(f.content.slug);await changed(f);const after=await doc(f.content.slug);
  assert.equal(after.needsRetest,true);assert.equal(after.products[0].facts.versionNo,2);assert.equal(after.products[0].referenceFacts.versionNo,1);
  assert.equal(after.products[0].facts.markets[0].availabilityStatus,'unavailable');assert.equal(after.products[0].referenceFacts.markets[0].availabilityStatus,'unknown');
  assert.deepEqual(after.guide,before.guide);assert.deepEqual(after.products[0].testRecord,before.products[0].testRecord);
  assert.equal(after.products[0].testRecord!.testedAt,before.products[0].testRecord!.testedAt);
});
test('R06/R07 reference update without a new bound Test Record cannot clear needsRetest',async()=>{
  const f=await guideFixture();f.content.guide.mode='hands_on';f.content.guide.products[0].testRecord=guideTestRecord(f.content.guide.products[0]);
  let d=await publishGuide(await createGuide(f.content));const next=await changed(f);d=await createEditorialDraft(d.id,guideAction(d),guideActor);
  f.content.guide.products[0].referencePublishedVersionId=next.version.id;
  await assert.rejects(saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor));
  const p=f.content.guide.products[0];p.testRecord=guideTestRecord(p); // Same old testedAt is also not a retest.
  await assert.rejects(saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor),{statusCode:400});
  p.testRecord=null;d=await saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor);
  await assert.rejects(publishGuide(d),{statusCode:422});assert.equal((await doc(f.content.slug)).needsRetest,true);
});
test('R08/R09 new Guide revision, reference, Test Record and Human Publish are required to clear needsRetest',async()=>{
  const f=await guideFixture();f.content.guide.mode='hands_on';f.content.guide.products[0].testRecord=guideTestRecord(f.content.guide.products[0]);
  let d=await publishGuide(await createGuide(f.content));const oldRevision=d.published!.id,next=await changed(f);
  d=await createEditorialDraft(d.id,guideAction(d),guideActor);const p=f.content.guide.products[0];p.referencePublishedVersionId=next.version.id;p.testRecord=guideTestRecord(p);p.testRecord.testedAt='2026-10-07T02:00:00Z';
  d=await saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor);assert.equal((await doc(f.content.slug)).needsRetest,true);
  d=await publishGuide(d);assert.notEqual(d.published!.id,oldRevision);assert.equal((await doc(f.content.slug)).needsRetest,false);
});
test('R10/R11 Restore preserves the historical reference and only primary reference controls needsRetest',async()=>{
  const f=await guideFixture(2),d=await publishGuide(await createGuide(f.content));await changed(f,1);assert.equal((await doc(f.content.slug)).needsRetest,false);
  await changed(f,0);const restored=await restoreEditorial(d.id,{...guideAction(d),sourceRevisionId:d.published!.id},guideActor);
  assert.deepEqual(restored.draft!.content,d.published!.content);assert.equal((await doc(f.content.slug)).needsRetest,true);
});
for(const visibility of ['private','unlisted'] as const)test(`SEO03 ${visibility} required Product hides the whole Guide, related links and sitemap immediately`,async()=>{
  const f=await guideFixture(2);await publishGuide(await createGuide(f.content));await visibilityChange(f.products[1].product.id,visibility);
  assert.deepEqual(await get(f.content.slug),{kind:'not_found'});assert.equal((await listPublicEditorial('guide')).some(d=>d.slug===f.content.slug),false);
  assert.doesNotMatch(await editorialSitemapXml(),new RegExp(f.content.slug));const rel=await listRelatedPublicEditorial(f.products[0].product.slug);
  assert.equal(rel.guides?.some(g=>g.slug===f.content.slug)??false,false);
});
test('SEO01/SEO02/SEO04/SEO05/SEO06 Draft, canonical, permanent old slug and Withdraw follow the existing Published Reader',async()=>{
  const f=await guideFixture(),d=await createGuide(f.content);assert.deepEqual(await get(f.content.slug),{kind:'not_found'});assert.doesNotMatch(await editorialSitemapXml(),new RegExp(f.content.slug));
  let p=await publishGuide(d);assert.equal((await doc(f.content.slug)).canonicalUrl,config.siteUrl+'/howto/'+f.content.slug);
  let draft=await createEditorialDraft(p.id,guideAction(p),guideActor);const old=f.content.slug;f.content.slug+='-current';
  draft=await saveEditorialDraft(p.id,{...guideAction(draft),content:f.content},guideActor);p=await publishGuide(draft);
  assert.deepEqual(await get(old),{kind:'redirect',slug:f.content.slug});const sitemap=await editorialSitemapXml();assert.match(sitemap,new RegExp('/howto/'+f.content.slug+'<'));assert.doesNotMatch(sitemap,new RegExp('/howto/'+old+'<'));
  await withdrawEditorial(p.id,guideAction(p),guideActor);assert.deepEqual(await get(old),{kind:'not_found'});assert.deepEqual(await get(f.content.slug),{kind:'not_found'});
});
test('SEO07 Product detail related guides contains only whole eligible Published Guides',async()=>{
  const f=await guideFixture();await publishGuide(await createGuide(f.content));const r=await resolvePublicProductBySlug(f.products[0].product.slug);
  assert.equal(r.kind,'found');if(r.kind==='found')assert.ok(r.product.relatedEditorial?.guides?.some(g=>g.slug===f.content.slug));
});
test('A-public asset file loss or rights revocation hides every public Guide outlet',async()=>{
  const f=await guideFixture(),a=await uploadEditorialAsset({bytes:await sharp({create:{width:16,height:16,channels:3,background:'red'}}).png().toBuffer(),fileName:'fixture.png',mime:'image/png',reason:guideReason},guideActor);
  await reviewEditorialAsset(a.id,{rightsBasis:'self_captured',rightsNote:'Synthetic drawing',sourceUrl:null,rightsReviewed:true,privacyReviewed:true,reason:guideReason},guideActor);
  f.content.guide.assets=[{assetId:a.id,role:'result',position:1,captionJa:'合成図',altJa:'結果の合成図'}];await publishGuide(await createGuide(f.content));
  const g=await doc(f.content.slug);assert.equal(g.assets[0].url,'/api/site/aifind/assets/'+a.id);assert.doesNotMatch(JSON.stringify(g),/storageKey|originalSha256|rightsNote|uploader|privacyReviewer/);
  await fs.unlink(path.join(config.dataDir,a.storageKey));assert.deepEqual(await get(f.content.slug),{kind:'not_found'});assert.doesNotMatch(await editorialSitemapXml(),new RegExp(f.content.slug));
});
test('Guide authored Markdown rejects active HTML, unsafe links and remote screenshots',async()=>{
  const f=await guideFixture();f.content.guide.stepsMd='# 手順\n<script>alert(1)</script>\n[x](javascript:alert(1))\n![external](https://example.com/leak.png)\n\n~~~js\nconsole.log(1)\n~~~';
  await publishGuide(await createGuide(f.content));const g=await doc(f.content.slug);
  assert.doesNotMatch(g.rendered.stepsMd,/<script|javascript:|<img/);assert.match(g.rendered.stepsMd,/<pre><code/);
});
