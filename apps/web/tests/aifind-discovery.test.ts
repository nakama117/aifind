// Real built SSR and Site API on an isolated loopback database, no fixture HTML.
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {spawn,execFileSync,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
const database=new URL(process.env.DATABASE_URL??'postgres://postgres@127.0.0.1:55432/aifind_discovery_web_test');
if(!['localhost','127.0.0.1','[::1]'].includes(database.hostname)||!/_(test|ci)$/.test(database.pathname)||database.search)throw Error('Local test database required');
const name=`aifind_public_web_${randomBytes(6).toString('hex')}_test`;
const fixture=fileURLToPath(new URL('../../../modules/aifind/tests/public-web-fixture.ts',import.meta.url));
let backend:ChildProcess,web:ChildProcess,origin='',api='',logs='',cookie='';
function started(child:ChildProcess,match:RegExp):Promise<string>{return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Server timeout '+logs)),15000);child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exit '+logs));});
  child.stderr!.on('data',s=>logs+=String(s));child.stdout!.on('data',s=>{logs+=String(s);const value=logs.match(match)?.[1];if(value){clearTimeout(timer);resolve(value);}});
});}
before(async()=>{
  Object.assign(process.env,{DATABASE_URL:database.toString(),NODE_ENV:'development',AIHOT_ENVIRONMENT:'development',SITE_URL:'http://127.0.0.1',SITE_PREVIEW:'false',AIFIND_PREVIEW_ENABLED:'true',
    AIHOT_CREDENTIALS_DIR:'/nonexistent-test-credentials',ADMIN_PASSWORD:'public-web-test-password',SESSION_SECRET:'public-web-test-session-0123456789',IMG_PROXY_SIGN_SECRET:'public-web-test-image-0123456789',
    COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_INTERNAL_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',LOG_LEVEL:'error'});
  for(const k of ['DEV_AUTH_ROLE','OPENAI_API_KEY','OPENAI_BASE_URL','FEISHU_LOGIN_APP_ID','FEISHU_LOGIN_APP_SECRET'])delete process.env[k];
  await import('../../../tests/setup.ts');
  backend=spawn(process.execPath,[fixture,'serve-discovery',name],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});api=await started(backend,/"previewTestApi":"([^"]+)"/);
  const login=await fetch(api+'/api/auth/password',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=public-web-test-password',redirect:'manual'});assert.equal(login.status,303);cookie=login.headers.get('set-cookie')!.split(';')[0];
  const env={...process.env,WEB_PORT:'0',WEB_HOST:'127.0.0.1',API_BASE_URL:api};
  for(const k of Object.keys(env))if(/API_KEY|PASSWORD|SECRET|TOKEN|DATABASE_URL|EGRESS_PROXY_URL/.test(k))delete env[k as keyof typeof env];
  web=spawn(process.execPath,[fileURLToPath(new URL('../server.ts',import.meta.url))],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});origin='http://127.0.0.1:'+await started(web,/"msg":"web started","port":(\d+)/);
});
after(async()=>{for(const child of [web,backend])if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}execFileSync(process.execPath,[fixture,'cleanup',name],{env:process.env,stdio:'pipe',windowsHide:true});});
async function page(path:string,auth=false){const response=await fetch(origin+path,{redirect:'manual',headers:auth?{cookie}:{}});return{response,$:load(await response.text())};}
test('SEO01/SEO02/SEO03/SEO04/SEO05 base indexable; filters noindex,follow and canonical directory',async()=>{
  const base=await page('/products');assert.equal(base.response.status,200);assert.equal(base.$('meta[name=robots]').length,0);
  for(const query of ['q=製品','capability=text','platform=web&japanese=usable&free=true','sort=name']){
    const p=await page('/products?'+query);assert.equal(p.response.status,200,query);assert.deepEqual(p.$('meta[name=robots]').attr('content')?.split(',').map(s=>s.trim()),['noindex','follow']);
    assert.equal(p.$('link[rel=canonical]').attr('href'),'http://127.0.0.1/products');
  }
  const second=await page('/products?page=2');assert.equal(second.$('link[rel=canonical]').attr('href'),'http://127.0.0.1/products?page=2');
});
test('SSR labelled controls retain URL state and show truthful count / clearing / empty search',async()=>{
  const p=await page('/products?q=製品%20A&platform=web&sort=name');assert.equal(p.response.status,200);
  assert.equal(p.$('input[name=q]').attr('value'),'製品 a');assert.equal(p.$('select[name=platform] option[selected]').attr('value'),'web');
  assert.equal(p.$('[data-product-card]').length,1);assert.match(p.$('[data-discovery-count]').text(),/1/);assert.equal(p.$('[data-clear-discovery]').attr('href'),'/products');
  assert.ok(p.$('label[for=discovery-q]').length);assert.ok(p.$('form[method=get]').length);
  const none=await page('/products?q=definitely-absent');assert.equal(none.$('[data-product-card]').length,0);assert.match(none.$('[data-no-products]').text(),/見つかりません/);
});
test('SSR Discovery query validation returns 400 for unsupported values without broadening results',async()=>{
  for(const path of ['/products?capability=fake','/products?free=yes','/products?page=0','/products?platform=web&platform=ios',...['ﬃ'.repeat(100),'\u0000'].map(q=>'/products?q='+encodeURIComponent(q))])assert.equal((await page(path)).response.status,400,path);
});
test('SEO06/SEO07/SEO08 Published details unchanged and sitemap excludes filters, admin, private/unlisted',async()=>{
  const p=await page('/products/aifind-preview-public-a');assert.equal(p.response.status,200);assert.match(p.$('title').text(),/AIFIND/);
  const map=await(await fetch(origin+'/sitemap-products.xml')).text();assert.doesNotMatch(map,/\?q=|\?capability=|admin|aifind-preview-public-[bc]/);
});
test('Homepage has recent verified products, real search and capability shortcuts while retaining news',async()=>{
  const p=await page('/');assert.match(p.$('[data-home-products]').text(),/最近確認されたAI/);
  assert.equal(p.$('[data-home-products] form[action="/products"] input[name=q]').length,1);
  assert.equal(p.$('[data-home-products] [data-capability-shortcut]').length,6);
  assert.ok(p.$('[data-home-products] [data-product-card]').length<=6);assert.match(p.$('[data-home-products]').text(),/日本語 Input|日本語入力/);
});
test('Discovery Preview is admin-only, noindex and uses genuine Product Domain / Published reader data',async()=>{
  const path='/admin/aifind/preview/product-discovery';assert.equal((await page(path)).response.status,302);
  const p=await page(path,true);assert.equal(p.response.status,200);assert.match(p.$('meta[name=robots]').attr('content')!,/noindex/);assert.match(p.response.headers.get('x-robots-tag')!,/noindex/);
  assert.equal(p.$('[data-preview-case]').length,16);assert.equal(p.$('[data-catalog-bootstrap]').length,1);
  assert.match(p.$('body').text(),/SYNTHETIC|合成/);assert.ok(p.$('a[href^="/admin/aifind/products/"]').length>=36);
});
test('Filtered SSR pagination retains criteria, count and order; registered aliases resolve without exposing Draft names',async()=>{
  const first=await page('/products?capability=coding'),next=first.$('a').filter((_i,e)=>first.$(e).text()==='次のページ').attr('href')!;
  assert.equal(first.$('[data-product-card]').length,24);assert.match(first.$('[data-discovery-count]').text(),/25/);assert.match(next,/capability=coding/);assert.match(next,/page=2/);
  const second=await page(next);assert.equal(second.$('[data-product-card]').length,1);assert.match(second.$('meta[name=robots]').attr('content')!,/noindex/);
  const alias=await page('/products?q=さくらライター');assert.equal(alias.$('[data-product-card]').length,1);assert.match(alias.$('[data-product-card]').text(),/Sakura Writer/);assert.doesNotMatch(alias.$('[data-product-card]').text(),/Secret Sakura/);
  for(const q of ['Private Only','Unlisted Only','Secret Sakura'])assert.equal((await page('/products?q='+encodeURIComponent(q))).$('[data-product-card]').length,0);
});
