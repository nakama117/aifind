import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import sharp from 'sharp';
import { closeDb, sql } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { installModules } from '@aihot/backend/modules';
import { SERVER_MODULES } from '@aihot/site/modules/server';
import { buildApp } from '../../../apps/api/src/app.ts';
import { guideFixture, createGuide, publishGuide, guideAction, guideActor, guideReason } from './guide-fixtures.ts';
import { uploadEditorialAsset, reviewEditorialAsset } from '../editorial/assets.ts';
import { visibilityChange } from './public-fixtures.ts';
import { withdrawEditorial } from '../editorial/documents.ts';
installModules(SERVER_MODULES);
const app=await buildApp(),old={dev:config.devAdmin,password:config.adminPassword};config.devAdmin=null;config.adminPassword='synthetic-guide-password';
const login=await app.inject({method:'POST',url:'/api/auth/password',headers:{'content-type':'application/x-www-form-urlencoded'},payload:'password=synthetic-guide-password'});
assert.equal(login.statusCode,303);const cookie=String(login.headers['set-cookie']).split(';')[0],csrf=(await app.inject({url:'/api/admin/me',headers:{cookie}})).json().csrf,headers={cookie,'x-csrf-token':csrf};
const root='/api/admin/aifind',publicRoot='/api/site/aifind';
after(async()=>{config.devAdmin=old.dev;config.adminPassword=old.password;await app.close();await closeDb();});
test('Attached older Guide assets remain reviewable beyond the newest100; batch lookup is admin-only and bounded',async()=>{
  const bytes=await sharp({create:{width:16,height:8,channels:3,background:'#557744'}}).png().toBuffer();
  const oldAsset=await uploadEditorialAsset({bytes,fileName:'old.png',mime:'image/png',reason:guideReason},guideActor);
  for(let i=0;i<101;i++)await uploadEditorialAsset({bytes,fileName:'new.png',mime:'image/png',reason:guideReason},guideActor);
  const recent=await app.inject({url:root+'/assets',headers});assert.equal(recent.json().length,100);assert.equal(recent.json().some((a:{id:string})=>a.id===oldAsset.id),false);
  const url=root+'/assets?ids='+oldAsset.id;
  assert.equal((await app.inject({url})).statusCode,401);
  const attached=await app.inject({url,headers});assert.equal(attached.statusCode,200,attached.body);assert.deepEqual(attached.json().map((a:{id:string})=>a.id),[oldAsset.id]);
  assert.equal((await app.inject({url:root+'/assets?ids=not-an-id',headers})).statusCode,400);
  assert.equal((await app.inject({url:root+'/assets?ids='+Array(31).fill(oldAsset.id).join(','),headers})).statusCode,400);
});
test('SEO08/SEO09 Admin Guide and asset reads/actions require auth, noindex/no-store and mutation CSRF',async()=>{
  for(const [method,path]of [['GET','/howto'],['POST','/howto'],['GET','/howto/missing'],['GET','/howto/missing/preview'],['PATCH','/howto/missing/draft'],['POST','/howto/missing/publish'],['GET','/assets'],['GET','/assets/missing/file'],['POST','/assets'],['POST','/assets/missing/review']]as const){
    const r=await app.inject({method,url:root+path,...(method==='GET'?{}:{payload:{}})});assert.equal(r.statusCode,401,path);assert.match(String(r.headers['x-robots-tag']),/noindex/);assert.match(String(r.headers['cache-control']),/no-store/);
    if(method!=='GET')assert.equal((await app.inject({method,url:root+path,headers:{cookie},payload:{}})).statusCode,403,path);
  }
});
test('Guide HTTP reuses real Domain for save, stale 409, preview and human publish',async()=>{
  const f=await guideFixture();let r=await app.inject({method:'POST',url:root+'/howto',headers,payload:{content:f.content,reason:guideReason}});assert.equal(r.statusCode,200,r.body);let d=r.json(),prefix=root+'/howto/'+d.id;
  const pre=await app.inject({url:prefix+'/preview',headers});assert.equal(pre.statusCode,200,pre.body);assert.equal(pre.json().preview.type,'guide');assert.equal(pre.json().preview.products[0].facts.slug,f.products[0].product.slug);
  const body={...guideAction(d),content:{...f.content,title:'[SYNTHETIC] 保存した手順'}};r=await app.inject({method:'PATCH',url:prefix+'/draft',headers,payload:body});assert.equal(r.statusCode,200,r.body);d=r.json();
  assert.equal((await app.inject({method:'PATCH',url:prefix+'/draft',headers,payload:body})).statusCode,409);
  assert.equal((await app.inject({url:publicRoot+'/howto/'+f.content.slug})).statusCode,404);
  r=await app.inject({method:'POST',url:prefix+'/publish',headers,payload:guideAction(d)});assert.equal(r.statusCode,200,r.body);
  assert.equal((await app.inject({url:publicRoot+'/howto/'+f.content.slug})).json().document.title,body.content.title);
});
test('A-public sanitized bytes are reachable only through an eligible Published Guide; originals have no route',async()=>{
  const f=await guideFixture(),bytes=await sharp({create:{width:64,height:32,channels:3,background:'#123456'}}).png().toBuffer();
  const a=await uploadEditorialAsset({bytes,fileName:'test.png',mime:'image/png',reason:guideReason},guideActor);
  const get=()=>app.inject({url:publicRoot+'/assets/'+a.id});
  assert.equal((await get()).statusCode,404);assert.equal((await app.inject({url:root+'/assets/'+a.id+'/file',headers})).statusCode,200);
  await reviewEditorialAsset(a.id,{rightsBasis:'self_captured',rightsNote:'Synthetic fixture',sourceUrl:null,rightsReviewed:true,privacyReviewed:true,reason:guideReason},guideActor);
  f.content.guide.assets=[{assetId:a.id,role:'step',position:1,captionJa:'合成図',altJa:'手順の合成図'}];const d=await createGuide(f.content);
  assert.equal((await get()).statusCode,404);const published=await publishGuide(d);
  const file=await get();assert.equal(file.statusCode,200,file.body);assert.equal(file.headers['content-type'],'image/webp');assert.match(String(file.headers['cache-control']),/no-store/);assert.equal(file.headers['x-content-type-options'],'nosniff');
  assert.notDeepEqual(file.rawPayload,bytes);
  for(const url of ['/uploads/aifind-editorial/'+a.processedSha256+'.webp',publicRoot+'/assets/'+a.id+'/original',publicRoot+'/assets/'+a.originalSha256])assert.equal((await app.inject({url})).statusCode,404,url);
  await visibilityChange(f.products[0].product.id,'unlisted');assert.equal((await get()).statusCode,404);
  await visibilityChange(f.products[0].product.id,'listed');assert.equal((await get()).statusCode,200);
  await withdrawEditorial(d.id,guideAction(published),guideActor);assert.equal((await get()).statusCode,404);
});
test('Asset HTTP multipart upload creates unreviewed bytes and explicitly reviews them',async()=>{
  const form=new FormData();form.set('image',new File([await sharp({create:{width:32,height:32,channels:3,background:'green'}}).webp().toBuffer()],'fixture.webp',{type:'image/webp'}));form.set('reason',guideReason);
  const request=new Request('http://localhost/upload',{method:'POST',body:form});
  const r=await app.inject({method:'POST',url:root+'/assets',headers:{...headers,'content-type':request.headers.get('content-type')!},payload:Buffer.from(await request.arrayBuffer())});
  assert.equal(r.statusCode,200,r.body);const a=r.json();assert.equal(a.rightsBasis,'unreviewed');assert.equal(a.privacyReviewedAt,null);
  const reviewed=await app.inject({method:'POST',url:root+'/assets/'+a.id+'/review',headers,payload:{rightsBasis:'self_captured',rightsNote:'Self-created synthetic fixture',sourceUrl:null,rightsReviewed:true,privacyReviewed:true,reason:guideReason}});
  assert.equal(reviewed.statusCode,200,reviewed.body);assert.ok(reviewed.json().privacyReviewedAt);
});
test('SEO10 Draft Guide OG is 404, Published OG uses safe title and SITE_URL metadata follows Reader',async()=>{
  const f=await guideFixture(),d=await createGuide(f.content);const og='/og/aifind-editorial/howto/'+f.content.slug+'.png';
  assert.equal((await app.inject({url:og})).statusCode,404);await publishGuide(d);const r=await app.inject({url:og});assert.equal(r.statusCode,200);assert.equal(r.headers['content-type'],'image/png');
  assert.doesNotMatch((await app.inject({url:'/sitemap-aifind-editorial.xml'})).body,/\/admin\//);
  const [receipts]=await sql`SELECT count(*)::int n FROM receipts`;assert.equal(receipts.n,0);
});
