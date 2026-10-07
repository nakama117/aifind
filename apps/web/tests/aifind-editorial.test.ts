// Real built SSR -> loopback HTTP -> Product and Editorial Domains, with a disposable DB.
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
import type {EditorialAdminDetail} from '../../../modules/aifind/editorial/contracts.ts';
import type {ProductAdminDetail} from '../../../modules/aifind/admin/contracts.ts';
const database=new URL(process.env.DATABASE_URL??'postgres://postgres@127.0.0.1:55432/aifind_editorial_web_test');
if(!['localhost','127.0.0.1','[::1]'].includes(database.hostname)||!/_(test|ci)$/.test(database.pathname)||database.search)throw Error('Local *_test/_ci database required');
const name=`aifind_editorial_web_${randomBytes(6).toString('hex')}_test`,fixture=fileURLToPath(new URL('../../../modules/aifind/tests/editorial-web-fixture.ts',import.meta.url));
let api='',origin='',cookie='',csrf='',logs='',web:ChildProcess|undefined,backend:ChildProcess|undefined,compareId='',categoryId='',productId='';
const compare='aifind-preview-editorial-compare',hands='aifind-preview-editorial-hands-on',category='aifind-preview-editorial-category',product='aifind-preview-discovery-03';
function started(child:ChildProcess,pattern:RegExp){return new Promise<string>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local server timeout: '+logs)),20000);child.once('exit',()=>{clearTimeout(timer);reject(Error('Local server exited: '+logs));});child.stderr!.on('data',s=>logs+=String(s));child.stdout!.on('data',s=>{logs+=String(s);const value=logs.match(pattern)?.[1];if(value){clearTimeout(timer);resolve(value);}});});}
before(async()=>{
  Object.assign(process.env,{DATABASE_URL:database.href,NODE_ENV:'development',AIHOT_ENVIRONMENT:'development',SITE_URL:'http://127.0.0.1',SITE_PREVIEW:'false',AIFIND_PREVIEW_ENABLED:'true',AIHOT_CREDENTIALS_DIR:'/nonexistent-test-credentials',ADMIN_PASSWORD:'editorial-web-test-password',SESSION_SECRET:'editorial-web-test-session-0123456789',IMG_PROXY_SIGN_SECRET:'editorial-web-test-image-0123456789',COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',AIFIND_DETECTOR_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_INTERNAL_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',LOG_LEVEL:'error'});
  for(const key of Object.keys(process.env))if(/API_KEY|TOKEN|EGRESS_PROXY_URL/.test(key)||key.startsWith('DEV_AUTH_')||key.startsWith('FEISHU_LOGIN_'))delete process.env[key];
  await import('../../../tests/setup.ts');backend=spawn(process.execPath,[fixture,'serve',name],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});api=await started(backend,/"editorialTestApi":"([^"]+)"/);
  const login=await fetch(api+'/api/auth/password',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=editorial-web-test-password',redirect:'manual'});assert.equal(login.status,303);cookie=login.headers.get('set-cookie')!.split(';')[0];csrf=(await(await fetch(api+'/api/admin/me',{headers:{cookie}})).json() as {csrf:string}).csrf;
  const env={...process.env,WEB_PORT:'0',WEB_HOST:'127.0.0.1',API_BASE_URL:api};for(const key of Object.keys(env))if(/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(key))delete (env as NodeJS.ProcessEnv)[key];web=spawn(process.execPath,[fileURLToPath(new URL('../server.ts',import.meta.url))],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});origin='http://127.0.0.1:'+await started(web,/"msg":"web started","port":(\d+)/);
  const docs=await(await fetch(api+'/api/admin/aifind/compare',{headers:{cookie}})).json() as Array<{id:string;public_slug:string}>;compareId=docs.find(d=>d.public_slug===compare)!.id;
  const cats=await(await fetch(api+'/api/admin/aifind/categories',{headers:{cookie}})).json() as Array<{id:string}>;categoryId=cats[0].id;
  const products=await(await fetch(api+'/api/admin/aifind/products?q=Mizu',{headers:{cookie}})).json() as {rows:Array<{id:string}>};productId=products.rows[0].id;
});
after(async()=>{for(const child of[web,backend])if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}execFileSync(process.execPath,[fixture,'cleanup',name],{env:process.env,stdio:'pipe',windowsHide:true});});
async function page(path:string,auth=false){const response=await fetch(origin+path,{redirect:'manual',headers:auth?{cookie}:{}});return{response,$:load(await response.text())};}
async function get<T>(path:string):Promise<T>{const r=await fetch(api+path,{headers:{cookie}});assert.equal(r.status,200);return r.json() as Promise<T>;}
async function action<T>(method:string,path:string,payload:unknown):Promise<T>{const r=await fetch(api+path,{method,headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,200,await r.clone().text());return r.json() as Promise<T>;}
const editorial=()=>get<EditorialAdminDetail>('/api/admin/aifind/compare/'+compareId),productAdmin=()=>get<ProductAdminDetail>('/api/admin/aifind/products/'+productId);
const reason='[SYNTHETIC] Built SSR human action';
test('Editorial Admin/Preview SSR denies anonymous, noindex/nofollow and sitemap excludes all admin paths',async()=>{
  for(const path of ['/admin/aifind/compare','/admin/aifind/compare/'+compareId,'/admin/aifind/categories','/admin/aifind/preview/compare-category']){assert.equal((await page(path)).response.status,302,path);const p=await page(path,true);assert.equal(p.response.status,200,path);assert.match(p.$('meta[name=robots]').attr('content')!,/noindex.*nofollow/);assert.match(p.response.headers.get('cache-control')!,/no-store/);}
  assert.doesNotMatch(await(await fetch(origin+'/sitemap-aifind-editorial.xml')).text(),/admin|secret-editorial-draft/);
});
test('Compare/Category real SSR renders human prose, current facts, references and separate price/status semantics',async()=>{
  for(const path of ['/compare','/compare/'+compare,'/categories','/categories/'+category])assert.equal((await page(path)).response.status,200,path);
  const p=await page('/compare/'+compare);assert.equal(p.$('[data-current-facts] th[data-fact-product]').length,3);assert.match(p.$('[data-comparison-references]').text(),/参照版 v1/);assert.match(p.$('[data-current-facts]').text(),/¥2,000 \/ 月/);
  assert.match(p.$('[data-status=unknown]').first().text(),/未確認/);assert.match(p.$('[data-status=unavailable]').first().text(),/利用不可/);assert.notEqual(p.$('[data-status=unknown]').first().attr('class'),p.$('[data-status=unavailable]').first().attr('class'));
  const c=await page('/categories/'+category);assert.equal(c.$('[data-curated-product]').length,5);assert.match(c.$('main').text(),/掲載順は順位ではありません/);
  for(const[type,text]of[['free','無料'],['fixed','¥2,000'],['custom','要問い合わせ'],['unknown','料金未確認']])assert.ok(c.$(`[data-price-type=${type}]`).text().includes(text),type);assert.doesNotMatch(c.$('[data-price-type=unknown]').text(),/無料/);
});
test('Official-source and hands-on SSR clearly differ; Test Records never invent ratings or scores',async()=>{
  const p=await page('/compare/'+compare),h=await page('/compare/'+hands);assert.match(p.$('[data-comparison-mode]').text(),/実測していません/);assert.equal(p.$('[data-test-record]').length,0);assert.match(h.$('[data-comparison-mode]').text(),/実測/);assert.equal(h.$('[data-test-record]').length,2);assert.match(h.$('[data-test-record]').text(),/SYNTHETIC|環境|手順|結果|限界|担当者/);
});
test('Compare directory separates Published date from reference and hands-on tested dates',async()=>{
  const p=await page('/compare');assert.match(p.$(`[data-editorial-card=${compare}] [data-reference-dates]`).text(),/参照版の公開日/);assert.match(p.$(`[data-editorial-card=${hands}] [data-tested-dates]`).text(),/実測日/);assert.match(p.$(`[data-editorial-card=${hands}]`).text(),/公開：/);
});
test('Comparison horizontal scroll is a labelled keyboard-focusable region with column and row headers',async()=>{
  const p=await page('/compare/'+compare),table=p.$('[data-current-facts]');assert.equal(table.attr('role'),'region');assert.equal(table.attr('tabindex'),'0');assert.ok(table.attr('aria-label'));assert.equal(table.find('thead th[scope=col]').length,4);assert.ok(table.find('tbody th[scope=row]').length>5);
});
test('Editorial SSR safe Markdown executes no authored HTML, handlers, frames, images or javascript links',async()=>{
  const p=await page('/compare/'+compare),body=p.$('[data-public-editorial]');assert.equal(body.find('script,iframe,img,object').length,0);assert.equal(body.find('[onerror],[onclick]').length,0);assert.equal(body.find('a[href^="javascript:"],a[href^="data:"]').length,0);assert.ok(body.find('h2').length>3);assert.doesNotMatch(body.text(),/SECRET EDITORIAL DRAFT/);
});
test('Editorial SEO uses SITE_URL canonical and controlled OG; JSON-LD has no fabricated ratings/reviews',async()=>{
  for(const[path,slug]of[['compare',compare],['categories',category]]){const p=await page('/'+path+'/'+slug);assert.equal(p.$('link[rel=canonical]').attr('href'),'http://127.0.0.1/'+path+'/'+slug);assert.equal(p.$('meta[property="og:image"]').attr('content'),'http://127.0.0.1/og/aifind-editorial/'+path+'/'+slug+'.png');assert.equal(p.$('meta[name=robots]').length,0);const ld=p.$('script[type="application/ld+json"]').text();assert.doesNotMatch(ld,/AggregateRating|ratingValue|"Review"/);const og=await fetch(origin+'/og/aifind-editorial/'+path+'/'+slug+'.png');assert.equal(og.status,200);assert.match(og.headers.get('content-type')!,/image\/png/);}
});
test('Product Draft and human Publish affect SSR current facts, never verdict; Product V2 visibly needs retest',async()=>{
  const before=await page('/compare/'+compare),verdict=before.$('[data-comparison-verdict]').html();let p=await productAdmin();
  await action('POST',`/api/admin/aifind/products/${productId}/draft`,{reason});p=await productAdmin();
  const plan=p.draft!.plans[0],price=plan.prices[0];await action('PATCH',`/api/admin/aifind/products/${productId}/draft/${p.draft!.version.id}`,{expectedRevision:p.draftRevision,reason,plans:[{planKey:plan.planKey,name:plan.name,prices:[{id:price.id,priceType:'fixed',amountMinor:2500,currencyCode:'JPY',billingPeriod:'month',evidenceId:price.evidenceId,verifiedAt:price.verifiedAt}]}]});
  assert.equal((await page('/compare/'+compare)).$('[data-current-facts]').html(),before.$('[data-current-facts]').html());p=await productAdmin();await action('POST',`/api/admin/aifind/products/${productId}/draft/${p.draft!.version.id}/publish`,{expectedRevision:p.draftRevision,reason});
  const after=await page('/compare/'+compare);assert.match(after.$('[data-current-facts]').text(),/¥2,500/);assert.equal(after.$('[data-comparison-verdict]').html(),verdict);assert.equal(after.$('[data-needs-retest]').length,1);assert.match(after.$('[data-comparison-references]').text(),/参照版 v1.*現在の公開版 v2/s);
  assert.equal((await page('/categories/'+category)).$('[data-product-info-updated]').length,1);
});
test('Published editorial and Draft stay separate; historical Restore produces new Draft without public changes',async()=>{
  const p=await page('/admin/aifind/compare/'+compareId,true);assert.match(p.$('[data-editorial-published]').text(),/SYNTHETIC/);assert.doesNotMatch(p.$('[data-editorial-published]').text(),/SECRET/);assert.equal(p.$('[data-editorial-draft] input[aria-label="タイトル"]').attr('value'),'SECRET EDITORIAL DRAFT');assert.equal(p.$('[data-editorial-preview]').length,1);
  const before=(await page('/compare/'+compare)).$('[data-public-editorial]').html(),d=await editorial();const restored=await action<EditorialAdminDetail>('POST',`/api/admin/aifind/compare/${compareId}/restore`,{expectedRevision:d.revision,sourceRevisionId:d.published!.id,reason});assert.notEqual(restored.draft!.id,d.published!.id);assert.equal((await page('/compare/'+compare)).$('[data-public-editorial]').html(),before);
});
test('Old editorial slug is direct 301 to the current self-canonical; Withdraw removes detail/home/related/sitemap/OG',async()=>{
  let d=await editorial();const slug=compare+'-renamed';d=await action<EditorialAdminDetail>('PATCH',`/api/admin/aifind/compare/${compareId}/draft`,{content:{...d.draft!.content,slug},expectedRevision:d.revision,reason});d=await action<EditorialAdminDetail>('POST',`/api/admin/aifind/compare/${compareId}/publish`,{expectedRevision:d.revision,reason});
  const old=(await page('/compare/'+compare)).response;assert.equal(old.status,301);assert.equal(old.headers.get('location'),'/compare/'+slug);assert.equal((await page('/compare/'+slug)).$('link[rel=canonical]').attr('href'),'http://127.0.0.1/compare/'+slug);
  assert.equal((await page('/products/'+product)).$(`[data-related-comparisons] [data-editorial-card=${slug}]`).length,1);
  await action('POST',`/api/admin/aifind/compare/${compareId}/withdraw`,{expectedRevision:d.revision,reason});for(const s of[compare,slug])assert.equal((await page('/compare/'+s)).response.status,404);
  for(const path of['/compare','/','/products/'+product])assert.equal((await page(path)).$(`[data-editorial-card=${slug}]`).length,0);assert.doesNotMatch(await(await fetch(origin+'/sitemap-aifind-editorial.xml')).text(),new RegExp(slug));assert.equal((await fetch(origin+'/og/aifind-editorial/compare/'+slug+'.png')).status,404);
});
test('One unlisted Product removes whole Category and remaining Compare from SSR and all fresh discovery exits',async()=>{
  const p=await productAdmin();await action('PATCH',`/api/admin/aifind/products/${productId}/public-settings`,{visibility:'unlisted',expectedRevision:p.identityRevision,reason});
  for(const path of['/compare/'+hands,'/categories/'+category])assert.equal((await page(path)).response.status,404,path);
  for(const path of['/','/compare','/categories','/products/aifind-preview-discovery-02']){const p=await page(path);assert.equal(p.$(`[data-editorial-card=${hands}],[data-editorial-card=${category}]`).length,0);if(path==='/')assert.equal(p.$('[data-home-comparisons],[data-home-categories]').length,0);}
  const map=await(await fetch(origin+'/sitemap-aifind-editorial.xml')).text();assert.doesNotMatch(map,new RegExp(hands+'|'+category+'|admin'));
});
