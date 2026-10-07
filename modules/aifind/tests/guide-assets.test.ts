import '../../../tests/setup.ts';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { config } from '@aihot/backend/config';
import { sql, closeDb } from '@aihot/backend/db';
import { uploadEditorialAsset, reviewEditorialAsset, assetBytes, assetPublishIssues } from '../editorial/assets.ts';
import { readEditorialAdmin } from '../editorial/read.ts';
import { saveEditorialDraft, createEditorialDraft, restoreEditorial } from '../editorial/documents.ts';
import { guideFixture, createGuide, publishGuide, guideAction, guideActor, guideReason } from './guide-fixtures.ts';
after(closeDb);
const image = (format: 'png'|'jpeg'|'webp' = 'png') => sharp({create:{width:120,height:60,channels:3,background:'#386cb0'}}).toFormat(format).toBuffer();
const upload = async (format: 'png'|'jpeg'|'webp' = 'png') => uploadEditorialAsset({bytes:await image(format),fileName:'synthetic.'+format,mime:'image/'+format,reason:guideReason},guideActor);
const clear = (id:string) => reviewEditorialAsset(id,{rightsBasis:'self_captured',rightsNote:'[SYNTHETIC] Self-created fixture.',sourceUrl:null,rightsReviewed:true,privacyReviewed:true,reason:guideReason},guideActor);
const attach = async (reviewed=true) => {
  const f=await guideFixture(), a=await upload();if(reviewed)await clear(a.id);
  f.content.guide.assets=[{assetId:a.id,role:'step',position:1,captionJa:'[SYNTHETIC] 手順の図',altJa:'合成された手順の図'}];
  const d=await createGuide(f.content);return{f,a,d};
};
for(const format of ['png','jpeg','webp'] as const)test(`A01/A02/A03 ${format} upload decodes and stores a sanitized persistent WebP`,async()=>{
  const a=await upload(format), bytes=await assetBytes(a.id);assert.ok(bytes);
  const meta=await sharp(bytes!).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,120);assert.equal(meta.height,60);
  assert.equal(a.mime,'image/webp');assert.equal(a.processedSha256,createHash('sha256').update(bytes!).digest('hex'));
  assert.equal(a.byteSize,bytes!.length);assert.match(a.storageKey,/^uploads\/aifind-editorial\/[a-f0-9]{64}\.webp$/);
  assert.deepEqual(await fs.readFile(path.join(config.dataDir,a.storageKey)),bytes);
});
for(const [name,mime,bytes] of [
  ['active.svg','image/svg+xml',Buffer.from('<svg onload="alert(1)"/>')],
  ['active.html','text/html',Buffer.from('<img src=x onerror=alert(1)>')],
  ['document.pdf','application/pdf',Buffer.from('%PDF-1.7')],
  ['bad.png','image/png',Buffer.from('broken image')],
  ['empty.png','image/png',Buffer.alloc(0)],
] as const)test(`A04/A05/A06/A13 rejects ${name} without creating an Asset row`,async()=>{
  const [before]=await sql`SELECT count(*)::int n FROM af_editorial_assets`;
  await assert.rejects(uploadEditorialAsset({fileName:name,mime,bytes,reason:guideReason},guideActor));
  assert.equal((await sql`SELECT count(*)::int n FROM af_editorial_assets`)[0].n,before.n);
});
test('A07/A08 filename traversal, extension mismatch and declared MIME mismatch are rejected',async()=>{
  const bytes=await image();for(const [fileName,mime]of [['../../escape.png','image/png'],['C:\\escape.png','image/png'],['fake.jpeg','image/png'],['fake.png','image/jpeg']])
    await assert.rejects(uploadEditorialAsset({bytes,fileName,mime,reason:guideReason},guideActor));
});
test('A09/A10 byte and decoded pixel limits reject oversized and pixel-bomb images',async()=>{
  await assert.rejects(uploadEditorialAsset({bytes:Buffer.alloc(5*1024*1024+1),fileName:'big.png',mime:'image/png',reason:guideReason},guideActor));
  const bytes=await sharp({create:{width:8000,height:8000,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(uploadEditorialAsset({bytes,fileName:'bomb.png',mime:'image/png',reason:guideReason},guideActor));
});
test('A11/A12 metadata is stripped, orientation normalized and large dimensions bounded',async()=>{
  const bytes=await sharp({create:{width:3000,height:1000,channels:3,background:'#336699'}}).withMetadata({orientation:6}).jpeg().toBuffer();
  const a=await uploadEditorialAsset({bytes,fileName:'oriented.jpg',mime:'image/jpeg',reason:guideReason},guideActor), out=await assetBytes(a.id), meta=await sharp(out!).metadata();
  assert.equal(meta.orientation,undefined);assert.equal(meta.exif,undefined);assert.equal(meta.icc,undefined);
  assert.equal(meta.width,800);assert.equal(meta.height,2400);assert.equal(a.originalSha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal((await fs.readdir(path.join(config.dataDir,'uploads/aifind-editorial'))).some(x=>x.endsWith('.jpg')),false);
});
test('A14 controlled Asset ID cannot become an arbitrary local filesystem path',async()=>{
  assert.equal(await assetBytes('../../.env'),null);assert.equal(await assetBytes('C:\\private'),null);
});
test('A15/AR01 new upload has no automatic rights or privacy clearance',async()=>{
  const a=await upload();assert.equal(a.rightsBasis,'unreviewed');assert.equal(a.rightsReviewedAt,null);assert.equal(a.privacyReviewedAt,null);
  assert.ok((await assetPublishIssues([a.id])).length>=2);
});
test('AR02/AR03 rights and privacy are independent explicit audited reviews',async()=>{
  const a=await upload(), r=await reviewEditorialAsset(a.id,{rightsBasis:'owned',rightsNote:'[SYNTHETIC] Owned fixture.',sourceUrl:null,rightsReviewed:true,privacyReviewed:false,reason:guideReason},guideActor);
  assert.ok(r.rightsReviewedAt);assert.equal(r.privacyReviewedAt,null);assert.match((await assetPublishIssues([a.id])).join(' '),/privacy/);
  await clear(a.id);assert.deepEqual(await assetPublishIssues([a.id]),[]);
  const actions=await sql`SELECT action FROM audit_log WHERE subject=${'aifind:asset:'+a.id}`;
  assert.ok(actions.some(r=>r.action==='aifind.asset.create'));assert.ok(actions.some(r=>r.action==='aifind.asset.review'));
});
test('AR04/AR05 Guide Publish requires caption, alt, rights and privacy clearance',async()=>{
  const {d,a}=await attach(false);await assert.rejects(publishGuide(d),{statusCode:422});
  await clear(a.id);const f=structuredClone(d.draft!.content);if(f.type!=='guide')throw Error('fixture');f.guide.assets[0].altJa='';
  const saved=await saveEditorialDraft(d.id,{...guideAction(d),content:f},guideActor);await assert.rejects(publishGuide(saved),{statusCode:422});
});
test('A16/A17 revision Asset relations are immutable Published history; Restore copies references only',async()=>{
  const {d,a}=await attach(), published=await publishGuide(d);
  await assert.rejects(sql`DELETE FROM af_editorial_revision_assets WHERE revision_id=${published.published!.id}`,{code:'23514'});
  const restored=await restoreEditorial(d.id,{...guideAction(published),sourceRevisionId:published.published!.id},guideActor);
  assert.deepEqual(restored.draft!.content,published.published!.content);
  assert.equal((await sql`SELECT count(*)::int n FROM af_editorial_assets WHERE id=${a.id}`)[0].n,1);
});
test('A18 reorder and detach affect Draft only and preserve Published asset bytes',async()=>{
  const {d,a}=await attach(), published=await publishGuide(d), draft=await createEditorialDraft(d.id,guideAction(published),guideActor);
  const c=structuredClone(draft.draft!.content);if(c.type!=='guide')throw Error('fixture');c.guide.assets=[];
  const saved=await saveEditorialDraft(d.id,{...guideAction(draft),content:c},guideActor);assert.equal(saved.published!.content.type,'guide');
  assert.deepEqual(saved.published,published.published);assert.ok(await assetBytes(a.id));
  assert.ok((await sql`SELECT action FROM audit_log WHERE subject=${'aifind:editorial:'+d.id}`).some(r=>r.action==='aifind.asset.detach'));
});
test('A19 missing persistent file blocks publish rather than reporting a complete preview',async()=>{
  const {a,d}=await attach();await fs.unlink(path.join(config.dataDir,a.storageKey));
  assert.ok((await assetPublishIssues([a.id])).some(x=>x.includes('file')));await assert.rejects(publishGuide(d),{statusCode:422});
});
test('A20 failed relation save rolls back; absent Asset ID cannot create dangling references',async()=>{
  const f=await guideFixture(),d=await createGuide(f.content);f.content.guide.assets=[{assetId:'missing',position:1,role:'step',captionJa:'図',altJa:'図'}];
  await assert.rejects(saveEditorialDraft(d.id,{...guideAction(d),content:f.content},guideActor));
  assert.deepEqual((await readEditorialAdmin(d.id)).draft!.content,d.draft!.content);
});
test('AR06/AR07/AR08 clearance can be revoked and requires a controlled rights basis and reason',async()=>{
  const a=await upload();await clear(a.id);
  const r=await reviewEditorialAsset(a.id,{rightsBasis:'unreviewed',rightsNote:'Recheck',sourceUrl:null,rightsReviewed:false,privacyReviewed:false,reason:guideReason},guideActor);
  assert.equal(r.rightsReviewedAt,null);assert.equal(r.privacyReviewedAt,null);assert.ok((await assetPublishIssues([a.id])).length);
  await assert.rejects(reviewEditorialAsset(a.id,{rightsBasis:'unknown',reason:''},guideActor));
});
