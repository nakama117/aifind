// Built SSR + real HTTP/Product Domain. Only loopback, explicitly disposable DB; no external calls.
import assert from "node:assert/strict";
import { before,after,test } from "node:test";
import { spawn,execFileSync,type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const database=new URL(process.env.DATABASE_URL??"postgres://postgres@127.0.0.1:55432/aifind_public_web_test");
if(!['localhost','127.0.0.1','[::1]'].includes(database.hostname)||!/_(test|ci)$/.test(database.pathname)||database.search) throw new Error('Local *_test/_ci database required');
const name=`aifind_public_web_${randomBytes(6).toString('hex')}_test`;
const fixture=fileURLToPath(new URL('../../../modules/aifind/tests/public-web-fixture.ts',import.meta.url));
let web:ChildProcess|undefined,backend:ChildProcess|undefined,api='',origin='',cookie='',csrf='',logs='',aId='';
const a='aifind-preview-public-a',b='aifind-preview-public-b',c='aifind-preview-public-c',d='aifind-preview-public-d-current';
const listedSlugs=[a,d,'aifind-web-free-current','aifind-web-free-expired','aifind-web-free-future'].sort();
function started(child:ChildProcess,match:RegExp):Promise<string> {return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server timeout: '+logs)),15000);
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited: '+logs));});
  child.stderr!.on('data',s=>logs+=String(s));child.stdout!.on('data',s=>{logs+=String(s);const value=logs.match(match)?.[1];if(value){clearTimeout(timer);resolve(value);}});
});}
before(async()=>{
  Object.assign(process.env,{DATABASE_URL:database.toString(),NODE_ENV:'development',AIHOT_ENVIRONMENT:'development',SITE_URL:'http://127.0.0.1',AIFIND_PREVIEW_ENABLED:'true',SITE_PREVIEW:'false',
    AIHOT_CREDENTIALS_DIR:'/nonexistent-test-credentials',ADMIN_PASSWORD:'public-web-test-password',SESSION_SECRET:'public-web-test-session-0123456789',IMG_PROXY_SIGN_SECRET:'public-web-test-image-0123456789',
    COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_INTERNAL_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',LOG_LEVEL:'error'});
  for(const k of ['DEV_AUTH_ROLE','DEV_AUTH_DISPLAY_NAME','OPENAI_API_KEY','OPENAI_BASE_URL','FEISHU_LOGIN_APP_ID','FEISHU_LOGIN_APP_SECRET']) delete process.env[k];
  await import('../../../tests/setup.ts');
  backend=spawn(process.execPath,[fixture,'serve',name],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  api=await started(backend,/"previewTestApi":"([^"]+)"/);
  const login=await fetch(api+'/api/auth/password',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=public-web-test-password',redirect:'manual'});
  assert.equal(login.status,303);cookie=login.headers.get('set-cookie')!.split(';')[0];
  csrf=(await(await fetch(api+'/api/admin/me',{headers:{cookie}})).json() as {csrf:string}).csrf;
  const env:NodeJS.ProcessEnv={...process.env,WEB_PORT:'0',WEB_HOST:'127.0.0.1',API_BASE_URL:api};
  for(const k of Object.keys(env)) if(/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(k)) delete env[k];
  web=spawn(process.execPath,[fileURLToPath(new URL('../server.ts',import.meta.url))],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  origin='http://127.0.0.1:'+await started(web,/"msg":"web started","port":(\d+)/);
  const products=(await(await fetch(api+'/api/admin/aifind/products',{headers:{cookie}})).json() as {rows:Array<{id:string;slug:string}>}).rows;
  aId=products.find(p=>p.slug===a)!.id;
});
after(async()=>{
  for(const child of [web,backend]) if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}
  execFileSync(process.execPath,[fixture,'cleanup',name],{env:process.env,stdio:'pipe',windowsHide:true});
});
async function page(path:string,auth=false){const response=await fetch(origin+path,{redirect:'manual',headers:auth?{cookie}:{}});return{response,$:load(await response.text())};}
async function admin(){return(await(await fetch(api+`/api/admin/aifind/products/${aId}`,{headers:{cookie}})).json()) as {
  identityRevision:number;published:{version:{id:string}};draftRevision:number;draft:{version:{id:string};plans:Array<{planKey:string;prices:Array<{id:string}>}>};evidence:Array<{id:string;url:string}>;
};}
async function patch(path:string,payload:unknown){const r=await fetch(api+path,{method:'PATCH',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,200,await r.text());}

test('W01/W02/W03/W04/W05 public SSR visibility is independent of Admin authentication',async()=>{
  assert.equal((await page('/products/'+c)).response.status,404);
  const p=await page('/products/'+a);assert.equal(p.response.status,200);assert.match(p.$('h1').text(),/製品 A/);assert.equal(p.$('meta[name=robots]').length,0);
  const unlisted=await page('/products/'+b);assert.equal(unlisted.response.status,200);assert.equal(unlisted.$('meta[name=robots]').attr('content'),'noindex,follow');
  assert.match(unlisted.response.headers.get('x-robots-tag')!,/noindex/);
  assert.equal((await page('/admin/aifind/products/'+aId)).response.status,302);
});
test('W06/W07/W08 listed cards alone appear on directory/home and sitemap',async()=>{
  const p=await page('/products');assert.equal(p.response.status,200);assert.equal(p.$('h1').text(),'AIを探す');
  assert.deepEqual(p.$('[data-product-card]').map((_i,e)=>p.$(e).attr('data-product-card')).get().sort(),listedSlugs);
  const home=await page('/');assert.equal(home.response.status,200);
  assert.deepEqual(home.$('[data-home-products] [data-product-card]').map((_i,e)=>home.$(e).attr('data-product-card')).get(),['aifind-web-free-current']);
  assert.doesNotMatch(home.$('[data-home-products]').text(),/未確認/);
  assert.match(home.response.headers.get('cache-control')!,/no-store/);
});
for(const [kind,expected] of [['current','無料プランあり'],['expired','未確認'],['future','未確認']] as const) test(`Published ${kind} free-price period has truthful directory and homepage cards`,async()=>{
  for(const path of ['/products','/']) {
    const p=await page(path),card=p.$(`[data-product-card=aifind-web-free-${kind}]`);
    if(path==='/'&&kind!=='current'){assert.equal(card.length,0,path+' unknown core '+kind);continue;}
    assert.equal(card.length,1,path+' '+kind);
    const row=card.find('dt').filter((_i,e)=>p.$(e).text()==='無料プラン').parent();
    assert.equal(row.find('dd').text(),expected,path+' '+kind);
  }
});
test('W09/W10/W12 old and intermediate slugs each 301 straight to the latest self-canonical',async()=>{
  for(const slug of ['aifind-preview-public-d-original','aifind-preview-public-d-middle']){
    const r=(await page('/products/'+slug)).response;assert.equal(r.status,301);assert.equal(r.headers.get('location'),'/products/'+d);assert.match(r.headers.get('cache-control')!,/no-store/);
  }
  const p=await page('/products/'+d);assert.equal(p.$('link[rel=canonical]').attr('href'),'http://127.0.0.1/products/'+d);assert.match(p.$('body').text(),/提供終了/);
});
test('W18 unknown and unavailable have different labels and visual status; Japanese supports stay separate',async()=>{
  const p=await page('/products/'+a);assert.equal(p.$('[data-platform=android]').attr('data-state'),'unavailable');assert.match(p.$('[data-platform=android]').text(),/利用不可/);
  assert.equal(p.$('[data-platform=ios]').attr('data-state'),'unknown');assert.match(p.$('[data-platform=ios]').text(),/未確認/);
  assert.notEqual(p.$('[data-platform=android] [data-status]').attr('class'),p.$('[data-platform=ios] [data-status]').attr('class'));
  assert.match(p.$('[data-japanese-ui]').text(),/未確認/);assert.match(p.$('[data-japanese-input]').text(),/対応/);assert.match(p.$('[data-japanese-output]').text(),/一部対応/);
});
test('W19/W20/W21/W22 free, fixed, from, custom and unknown retain exact native-currency price meanings',async()=>{
  const p=await page('/products/'+a);
  for(const [type,want] of [['free','無料'],['fixed','$20 / 月'],['from','¥3,000〜 / 月'],['custom','要問い合わせ'],['unknown','料金未確認']]) assert.ok(p.$(`[data-price-type=${type}]`).text().includes(want),type);
  assert.doesNotMatch(p.$('[data-price-type=unknown]').text(),/無料|\$|¥/);assert.doesNotMatch(p.$('[data-price-type=custom]').text(),/料金未確認/);
  assert.doesNotMatch(p.$('[data-price-type=fixed]').text(),/¥/);assert.match(p.$('[data-price-type=fixed]').text(),/USD/);
});
test('W13/W14/W15/W16/W17 Draft edits do not alter public SSR, home, list, JSON-LD or sitemap',async()=>{
  const before=await page('/products/'+a),listBefore=(await page('/products')).$('main').html(),homeBefore=(await page('/')).$('[data-home-products]').html();
  const mapBefore=await(await fetch(origin+'/sitemap-products.xml')).text(), dtoBefore=await(await fetch(api+'/api/site/aifind/products/'+a)).text();
  const detail=await admin(),e=detail.evidence.find(e=>e.url.endsWith('/product'))!;
  await patch(`/api/admin/aifind/products/${aId}/draft/${detail.draft.version.id}`,{expectedRevision:detail.draftRevision,reason:'Synthetic SSR draft isolation',
    version:{summaryJa:'SECRET DRAFT 日本語の下書き'},languages:[{languageCode:'ja',inputSupport:'none',outputSupport:'none',uiSupport:'none',evidenceId:e.id,verifiedAt:'2026-10-06T01:00:00Z'}],
    plans:[{planKey:'preview-fixed',name:'Pro',prices:[{id:detail.draft.plans.find(p=>p.planKey==='preview-fixed')!.prices[0].id,priceType:'fixed',currencyCode:'USD',amountMinor:12345,billingPeriod:'month',evidenceId:e.id,verifiedAt:'2026-10-06T01:00:00Z'}]}]});
  const after=await page('/products/'+a);
  assert.equal(after.$('[data-public-product]').html(),before.$('[data-public-product]').html());assert.equal(after.$('script[type="application/ld+json"]').text(),before.$('script[type="application/ld+json"]').text());
  assert.equal((await page('/products')).$('main').html(),listBefore);assert.equal((await page('/')).$('[data-home-products]').html(),homeBefore);
  assert.equal(await(await fetch(origin+'/sitemap-products.xml')).text(),mapBefore);assert.equal(await(await fetch(api+'/api/site/aifind/products/'+a)).text(),dtoBefore);
  assert.doesNotMatch(after.$('body').text(),/SECRET DRAFT|INTERNAL_PREVIEW_NOTE|123\.45|99\.99/);
});
test('W23/W33 detail verification/SEO/SoftwareApplication contain supported facts only',async()=>{
  const p=await page('/products/'+a);assert.equal(p.$('[data-last-verified] time').attr('datetime'),'2026-10-06T00:00:00.000Z');assert.match(p.$('[data-last-verified]').text(),/2026年10月6日/);
  assert.equal(p.$('title').text(),'[PREVIEW] 製品 Aとは？料金・日本語対応・機能 | AIFIND');assert.match(p.$('meta[name=description]').attr('content')!,/文章作成/);
  const ld=JSON.parse(p.$('script[type="application/ld+json"]').filter((_i,e)=>p.$(e).text().includes('SoftwareApplication')).text());assert.equal(ld['@type'],'SoftwareApplication');assert.equal(ld.name,'[PREVIEW] 製品 A');assert.equal(ld.url,'http://127.0.0.1/products/'+a);
  assert.equal(ld.aggregateRating,undefined);assert.equal(ld.review,undefined);assert.equal(ld.offers,undefined);
  assert.equal(p.$('[data-public-evidence] a').length,2);assert.doesNotMatch(p.$('[data-public-evidence]').text(),/INTERNAL|evidenceNote/);
  const og=await fetch(origin+'/og/products/'+a+'.png');assert.equal(og.status,200);assert.match(og.headers.get('content-type')!,/image\/png/);assert.match(og.headers.get('cache-control')!,/no-store/);
});
test('W31/W32/W34/W35 withdrawal removes fresh SSR, directory, home, product map and historical public URLs',async()=>{
  const state=await admin();await patch(`/api/admin/aifind/products/${aId}/public-settings`,{visibility:'unlisted',expectedRevision:state.identityRevision,reason:'SSR unlisting test'});
  assert.equal((await page('/products/'+a)).response.status,200);assert.equal((await page('/products')).$(`[data-product-card=${a}]`).length,0);assert.equal((await page('/')).$(`[data-product-card=${a}]`).length,0);
  assert.doesNotMatch(await(await fetch(origin+'/sitemap-products.xml')).text(),new RegExp(a));
  await patch(`/api/admin/aifind/products/${aId}/public-settings`,{visibility:'private',expectedRevision:(await admin()).identityRevision,reason:'SSR withdrawal test'});
  const gone=await page('/products/'+a);assert.equal(gone.response.status,404);assert.match(gone.response.headers.get('cache-control')!,/no-store/);
  assert.equal((await fetch(origin+'/og/products/'+a+'.png')).status,404);
  assert.doesNotMatch(await(await fetch(origin+'/sitemap-products.xml')).text(),/admin|aifind-preview-public-[abc]/);
  await patch(`/api/admin/aifind/products/${aId}/public-settings`,{visibility:'listed',expectedRevision:(await admin()).identityRevision,reason:'Restore synthetic fixture'});
});
test('Admin public settings exposes readiness and Japanese Draft summary while public navigation links only the directory',async()=>{
  const p=await page('/admin/aifind/products/'+aId,true);assert.equal(p.response.status,200);assert.match(p.$('[data-public-settings]').text(),/公開設定|初回公開|公開可能/);
  assert.equal(p.$('textarea[aria-label="Draft Japanese summary"]').length,1);
  const directory=await page('/products');assert.ok(directory.$('nav a[href="/products"]').length>0);assert.equal(directory.$('a[href^="/admin/aifind"]').length,0);
});
