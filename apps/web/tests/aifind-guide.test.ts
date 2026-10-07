// Built SSR -> local Site API -> real Editorial/Product reader. No browser JS needed.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import type { EditorialAdminDetail } from '../../../modules/aifind/editorial/contracts.ts';
import type { ProductAdminDetail } from '../../../modules/aifind/admin/contracts.ts';
const database=new URL(process.env.DATABASE_URL??'postgres://postgres@127.0.0.1:55432/aifind_guide_web_test');
if(!['localhost','127.0.0.1','[::1]'].includes(database.hostname)||!/_(test|ci)$/.test(database.pathname)||database.search)throw Error('Local *_test/_ci required');
const name='aifind_guide_web_'+randomBytes(6).toString('hex')+'_test',fixture=fileURLToPath(new URL('../../../modules/aifind/tests/guide-web-fixture.ts',import.meta.url));
const official='aifind-preview-guide-official',hands='aifind-preview-guide-hands-on',draftOnly='aifind-preview-guide-draft-only',productSlug='aifind-preview-discovery-03';
let api='',origin='',cookie='',csrf='',logs='',id='',productId='',assetId='',web:ChildProcess|undefined,backend:ChildProcess|undefined;
function started(child:ChildProcess,pattern:RegExp){return new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server timeout: '+logs)),20000);child.once('exit',()=>{clearTimeout(timer);reject(Error('Local server exited: '+logs));});child.stderr!.on('data',s=>logs+=String(s));child.stdout!.on('data',s=>{logs+=String(s);const value=logs.match(pattern)?.[1];if(value){clearTimeout(timer);resolve(value);}});});}
before(async()=>{
  Object.assign(process.env,{DATABASE_URL:database.href,NODE_ENV:'development',AIHOT_ENVIRONMENT:'development',SITE_URL:'http://127.0.0.1',SITE_PREVIEW:'false',AIFIND_PREVIEW_ENABLED:'true',AIHOT_CREDENTIALS_DIR:'/nonexistent-test-credentials',ADMIN_PASSWORD:'guide-web-test-password',SESSION_SECRET:'guide-web-test-session-0123456789',IMG_PROXY_SIGN_SECRET:'guide-web-test-image-0123456789',COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',AIFIND_DETECTOR_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_INTERNAL_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',LOG_LEVEL:'error'});
  for(const k of Object.keys(process.env))if(/API_KEY|TOKEN|EGRESS_PROXY_URL/.test(k)||k.startsWith('DEV_AUTH_')||k.startsWith('FEISHU_LOGIN_'))delete process.env[k];
  await import('../../../tests/setup.ts');
  backend=spawn(process.execPath,[fixture,'serve',name],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});api=await started(backend,/"guideTestApi":"([^"]+)"/);
  const login=await fetch(api+'/api/auth/password',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=guide-web-test-password',redirect:'manual'});assert.equal(login.status,303);cookie=login.headers.get('set-cookie')!.split(';')[0];csrf=(await(await fetch(api+'/api/admin/me',{headers:{cookie}})).json() as {csrf:string}).csrf;
  const env={...process.env,WEB_PORT:'0',WEB_HOST:'127.0.0.1',API_BASE_URL:api};for(const k of Object.keys(env))if(/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(k))delete (env as NodeJS.ProcessEnv)[k];
  web=spawn(process.execPath,[fileURLToPath(new URL('../server.ts',import.meta.url))],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});origin='http://127.0.0.1:'+await started(web,/"msg":"web started","port":(\d+)/);
  const rows=await get<Array<{id:string;public_slug:string}>>('/api/admin/aifind/howto');id=rows.find(r=>r.public_slug===official)!.id;
  const p=await get<{rows:Array<{id:string;slug:string}>}>('/api/admin/aifind/products?q=Mizu');productId=p.rows.find(p=>p.slug===productSlug)!.id;
  const d=await detail();if(d.published!.content.type!=='guide')throw Error('fixture');assetId=d.published!.content.guide.assets[0].assetId;
});
after(async()=>{for(const child of[web,backend])if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}execFileSync(process.execPath,[fixture,'cleanup',name],{env:process.env,stdio:'pipe',windowsHide:true});});
async function page(path:string,auth=false){const response=await fetch(origin+path,{redirect:'manual',headers:auth?{cookie}:{}});return{response,$:load(await response.text())};}
async function get<T>(path:string):Promise<T>{const r=await fetch(api+path,{headers:{cookie}});assert.equal(r.status,200);return r.json() as Promise<T>;}
async function action<T>(method:string,path:string,payload:unknown):Promise<T>{const r=await fetch(api+path,{method,headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,200,await r.clone().text());return r.json() as Promise<T>;}
const detail=()=>get<EditorialAdminDetail>('/api/admin/aifind/howto/'+id),reason='[SYNTHETIC] SSR human acceptance';
test('Guide Admin/Preview SSR denies anonymous and stays noindex/no-store outside sitemap',async()=>{
  for(const path of ['/admin/aifind/howto','/admin/aifind/howto/'+id,'/admin/aifind/preview/howto-guide']){
    const anon=(await page(path)).response;assert.equal(anon.status,302,path);assert.equal(anon.headers.get('location'),'/api/auth/login?return='+encodeURIComponent(path));
    const p=await page(path,true);assert.equal(p.response.status,200,path);assert.match(p.$('meta[name=robots]').attr('content')!,/noindex.*nofollow/);assert.match(p.response.headers.get('cache-control')!,/no-store/);
  }
  assert.doesNotMatch(await(await fetch(origin+'/sitemap-aifind-editorial.xml')).text(),/\/admin\//);assert.equal((await page('/howto/'+draftOnly)).response.status,404);
});
test('Guide SSR presents task, prerequisites, environment, materials, steps, result, failures, limits, alternatives and sources in order',async()=>{
  const p=await page('/howto/'+official);assert.equal(p.response.status,200);assert.deepEqual(p.$('[data-guide-section]').map((_,e)=>p.$(e).attr('data-guide-section')).get(),['task','prerequisites','environment','materials','steps','result','failures','limitations','alternatives','facts','sources','related']);
  assert.match(p.$('[data-guide-mode]').text(),/公式資料に基づく解説.*AIFINDによる実測ではありません/);assert.equal(p.$('[data-tested-at]').length,0);assert.ok(p.$('[data-guide-steps] ol li').length>=3);assert.ok(p.$('[data-guide-section=materials] pre code').length);assert.ok(p.$('[data-guide-steps] table').length);
  assert.doesNotMatch(p.$('[data-public-guide]').text(),/SECRET GUIDE DRAFT|storageKey|rightsNote|originalSha256|privacyReviewer/);
});
test('Guide current versus reference facts preserve unknown/unavailable and free/fixed/custom/unknown price semantics',async()=>{
  const p=await page('/howto/'+official),h=await page('/howto/'+hands);
  assert.ok(p.$('[data-current-facts]').length);assert.ok(p.$('[data-reference-facts]').length);assert.ok(p.$('[data-price-type=free]').length);assert.ok(p.$('[data-price-type=fixed]').length);
  assert.ok(h.$('[data-price-type=custom]').length);assert.ok(h.$('[data-price-type=unknown]').length);assert.match(h.$('[data-price-type=unknown]').text(),/料金未確認/);assert.match(h.$('[data-price-type=custom]').text(),/問い合わせ/);
  assert.ok(p.$('[data-status=unknown]').length);assert.ok(p.$('[data-status=unavailable]').length);assert.notEqual(p.$('[data-status=unknown]').first().attr('class'),p.$('[data-status=unavailable]').first().attr('class'));
});
test('Guide hands_on SSR shows a bound synthetic Test Record and independent testedAt',async()=>{
  const p=await page('/howto/'+hands);assert.equal(p.$('[data-test-record]').length,1);assert.match(p.$('[data-tested-at]').text(),/testedAt.*JST.*担当者/);assert.equal(p.$('[data-tested-at] time').attr('datetime'),'2026-10-06T01:00:00.000Z');assert.match(p.$('[data-synthetic-notice]').text(),/実在する製品を試した結果ではありません/);
});
test('Guide sanitized image SSR has caption/alt; Draft admin file is protected and original route absent',async()=>{
  const p=await page('/howto/'+official),image=p.$('[data-guide-image] img');assert.ok(image.attr('alt'));assert.match(p.$('[data-guide-image] figcaption').text(),/SYNTHETIC/);
  const file=await fetch(origin+image.attr('src'));assert.equal(file.status,200);assert.match(file.headers.get('content-type')!,/image\/webp/);assert.match(file.headers.get('cache-control')!,/no-store/);
  assert.equal((await fetch(origin+'/api/admin/aifind/assets/'+assetId+'/file')).status,401);assert.equal((await fetch(origin+'/api/site/aifind/assets/'+assetId+'/original')).status,404);
});
test('Guide SEO has SITE_URL canonical/OG, WebPage/BreadcrumbList and no fabricated HowTo/review/rating markup',async()=>{
  const p=await page('/howto/'+official);assert.equal(p.$('link[rel=canonical]').attr('href'),'http://127.0.0.1/howto/'+official);assert.equal(p.$('meta[property="og:image"]').attr('content'),'http://127.0.0.1/og/aifind-editorial/howto/'+official+'.png');assert.equal(p.$('meta[name=robots]').length,0);
  const ld=p.$('script[type="application/ld+json"]').text();assert.match(ld,/WebPage/);assert.match(ld,/BreadcrumbList/);assert.doesNotMatch(ld,/HowTo|AggregateRating|ratingValue|"Review"/);
});
test('Guide phone navigation gives every configured tab a real column and keeps the Guide link',async()=>{
  const p=await page('/howto/'+official),nav=p.$('nav[aria-label="下部ナビゲーション"]'),count=nav.find('a').length;
  assert.equal(count,8);assert.equal(nav.find('a[href="/howto"]').length,1);
  assert.equal(nav.children('div').attr('style'),'grid-template-columns:repeat('+count+',minmax(0,1fr))');
});
test('Guide published links appear on Product, directory and home only through real shared Product references',async()=>{
  assert.ok((await page('/howto')).$('[data-editorial-card='+official+']').length);assert.ok((await page('/')).$('[data-home-guides] [data-editorial-card='+official+']').length);
  assert.ok((await page('/products/'+productSlug)).$('[data-related-guides] [data-editorial-card='+official+']').length);
  const p=await page('/howto/'+official);assert.ok(p.$('[data-guide-section=related] a[href^="/compare/"]').length);assert.ok(p.$('[data-guide-section=related] a[href^="/categories/"]').length);
});
test('Guide Product Draft is isolated; new Product Published updates current facts and retest while steps/results stay intact',async()=>{
  const before=await page('/howto/'+official),steps=before.$('[data-guide-steps]').html(),result=before.$('[data-guide-result]').html();
  await action('POST','/api/admin/aifind/products/'+productId+'/draft',{reason});let p=await get<ProductAdminDetail>('/api/admin/aifind/products/'+productId);
  const plan=p.draft!.plans[0],price=plan.prices[0];await action('PATCH',`/api/admin/aifind/products/${productId}/draft/${p.draft!.version.id}`,{expectedRevision:p.draftRevision,reason,plans:[{planKey:plan.planKey,name:plan.name,prices:[{id:price.id,priceType:'fixed',currencyCode:'JPY',amountMinor:2500,billingPeriod:'month',evidenceId:price.evidenceId,verifiedAt:price.verifiedAt}]}]});
  assert.equal((await page('/howto/'+official)).$('[data-current-facts]').html(),before.$('[data-current-facts]').html());p=await get<ProductAdminDetail>('/api/admin/aifind/products/'+productId);
  await action('POST',`/api/admin/aifind/products/${productId}/draft/${p.draft!.version.id}/publish`,{expectedRevision:p.draftRevision,reason});
  const fresh=await page('/howto/'+official);assert.equal(fresh.$('[data-needs-retest]').length,1);assert.match(fresh.$('[data-current-facts]').text(),/¥2,500/);assert.doesNotMatch(fresh.$('[data-reference-facts]').text(),/¥2,500/);assert.equal(fresh.$('[data-guide-steps]').html(),steps);assert.equal(fresh.$('[data-guide-result]').html(),result);
});
test('Guide Saved Draft Preview shows separately marked Published/Draft and Restore preserves binary/history',async()=>{
  const before=await page('/howto/'+official),d=await detail(),p=await page('/admin/aifind/howto/'+id,true);
  assert.doesNotMatch(p.$('[data-editorial-published]').text(),/SECRET GUIDE DRAFT/);assert.equal(p.$('[data-guide-editor] input[aria-label="タイトル"]').attr('value'),'SECRET GUIDE DRAFT');assert.equal(p.$('[data-editorial-preview]').length,1);
  const restored=await action<EditorialAdminDetail>('POST','/api/admin/aifind/howto/'+id+'/restore',{expectedRevision:d.revision,sourceRevisionId:d.published!.id,reason});assert.notEqual(restored.draft!.id,d.published!.id);assert.equal((await page('/howto/'+official)).$('[data-public-guide]').html(),before.$('[data-public-guide]').html());
});
test('Guide old slug is one direct 301; unlisted dependency removes every public outlet including screenshot and OG',async()=>{
  let d=await detail();d=await action<EditorialAdminDetail>('PATCH','/api/admin/aifind/howto/'+id+'/draft',{expectedRevision:d.revision,reason,content:{...d.draft!.content,slug:official+'-current'}});
  d=await action<EditorialAdminDetail>('POST','/api/admin/aifind/howto/'+id+'/publish',{expectedRevision:d.revision,reason});
  const old=(await page('/howto/'+official)).response;assert.equal(old.status,301);assert.equal(old.headers.get('location'),'/howto/'+official+'-current');
  const p=await get<ProductAdminDetail>('/api/admin/aifind/products/'+productId);await action('PATCH','/api/admin/aifind/products/'+productId+'/public-settings',{visibility:'unlisted',expectedRevision:p.identityRevision,reason});
  for(const s of[official,official+'-current'])assert.equal((await page('/howto/'+s)).response.status,404);
  assert.equal((await fetch(origin+'/api/site/aifind/assets/'+assetId)).status,404);assert.equal((await fetch(origin+'/og/aifind-editorial/howto/'+official+'-current.png')).status,404);
  assert.doesNotMatch(await(await fetch(origin+'/sitemap-aifind-editorial.xml')).text(),new RegExp(official));assert.equal((await page('/')).$('[data-editorial-card='+official+'-current]').length,0);
});
