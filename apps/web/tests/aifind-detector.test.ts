import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {before,after,test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {load} from 'cheerio';
let apiProcess:ChildProcess,web:ChildProcess,api='',origin='',cookie='',csrf='',logs='';
const name='aifind_web_preview_'+randomBytes(6).toString('hex')+'_test';
const fixture=fileURLToPath(new URL('../../../modules/aifind/tests/preview-web-fixture.ts',import.meta.url));
const preview='/admin/aifind/preview/change-detector';
async function address(child:ChildProcess,pattern:RegExp):Promise<string>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout '+logs)),15000);child.once('exit',()=>{clearTimeout(timer);reject(Error('early exit '+logs));});child.stderr?.on('data',b=>{logs+=String(b);});child.stdout?.on('data',b=>{logs+=String(b);const m=logs.match(pattern);if(m){clearTimeout(timer);resolve(m[1]);}});});}
before(async()=>{
  const db=new URL(process.env.DATABASE_URL??'postgres://postgres@127.0.0.1:55432/aifind_phase4_test');
  if(!/_(test|ci)$/.test(db.pathname)||!['localhost','127.0.0.1','[::1]'].includes(db.hostname))throw Error('local safe test DB required');
  Object.assign(process.env,{DATABASE_URL:db.href,AIFIND_PREVIEW_ENABLED:'true',AIFIND_DETECTOR_ENABLED:'false',SITE_PREVIEW:'true',SITE_URL:'http://127.0.0.1',NODE_ENV:'development',AIHOT_ENVIRONMENT:'development',ADMIN_PASSWORD:'detector-web-test-password',SESSION_SECRET:'detector-web-test-session-0123456789',IMG_PROXY_SIGN_SECRET:'detector-web-test-image-0123456789',COLLECT_ENABLED:'false',MODEL_CALLS_ENABLED:'false',FEISHU_CONTENT_PUSH_ENABLED:'false',FEISHU_INTERNAL_ENABLED:'false',INDEXNOW_SUBMIT_ENABLED:'false',LOG_LEVEL:'error'});
  for(const k of Object.keys(process.env))if(/API_KEY|TOKEN|EGRESS_PROXY_URL|DEV_AUTH/.test(k))delete process.env[k];
  apiProcess=spawn(process.execPath,[fixture,'serve-detector',name],{env:process.env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  api=await address(apiProcess,/"previewTestApi":"([^"]+)"/);
  const login=await fetch(api+'/api/auth/password',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=detector-web-test-password'});
  assert.equal(login.status,303);cookie=login.headers.get('set-cookie')!.split(';')[0];csrf=(await (await fetch(api+'/api/admin/me',{headers:{cookie}})).json() as {csrf:string}).csrf;
  const env={...process.env,WEB_HOST:'127.0.0.1',WEB_PORT:'0',API_BASE_URL:api};
  for(const k of Object.keys(env))if(/DATABASE_URL|API_KEY|PASSWORD|SECRET|TOKEN|EGRESS_PROXY_URL/.test(k))delete env[k as keyof typeof env];
  web=spawn(process.execPath,[fileURLToPath(new URL('../server.ts',import.meta.url))],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  origin='http://127.0.0.1:'+await address(web,/"msg":"web started","port":(\d+)/);
});
after(async()=>{for(const child of [web,apiProcess])if(child && child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}execFileSync(process.execPath,[fixture,'cleanup',name],{env:process.env,stdio:'pipe',windowsHide:true});});
async function page(path=preview){const r=await fetch(origin+path,{headers:{cookie},redirect:'manual'});assert.equal(r.status,200,path+': '+logs);return {r,$:load(await r.text())};}
test('Phase 4 HTML and data loaders deny anonymous; authenticated Preview is noindex/no-store and excluded from public navigation/sitemap',async()=>{
  for(const suffix of ['', '.data']){const r=await fetch(origin+preview+suffix,{redirect:'manual'});assert.equal(r.status,suffix?202:302);assert.doesNotMatch(await r.text(),/proposalKey|source_text|observations/);}
  const {r,$}=await page();assert.match(r.headers.get('x-robots-tag')!,/noindex/);assert.match(r.headers.get('cache-control')!,/no-store/);assert.match($('meta[name=robots]').attr('content')!,/noindex/);
  const hub=await page('/admin/aifind/preview');assert.ok(hub.$('a[href="'+preview+'"]').length);
  for(const url of ['/sitemap.xml','/sitemap-products.xml','/feed.xml','/llms.txt'])assert.doesNotMatch(await (await fetch(origin+url)).text(),/admin\/aifind\/preview\/change-detector/);
  const home=load(await (await fetch(origin+'/')).text());assert.equal(home('a[href="'+preview+'"]').length,0);
});
test('Real queued DB Candidate renders Current/Proposed, Evidence and independent Published/Draft areas; Review provenance remains private',async()=>{
  const queued=await fetch(api+'/api/admin/aifind/preview/change-detector/run',{method:'POST',headers:{cookie,'x-csrf-token':csrf,'content-type':'application/json'},body:JSON.stringify({fixtureKey:'main',reason:'Synthetic SSR worker'})});assert.equal(queued.status,200);
  let id='';for(let i=0;i<120;i++){const view=await (await fetch(api+'/api/admin/aifind/preview/change-detector',{headers:{cookie}})).json() as {candidates:Array<{candidate:{id:string}}>} ;id=view.candidates[0]?.candidate.id??'';if(id)break;await new Promise(r=>setTimeout(r,100));}assert.ok(id,'worker produced candidate');
  const {$}=await page();assert.match($('[data-detector-current]').text(),/2,400|2400/);assert.match($('[data-detector-proposed]').text(),/2,800|2800/);
  assert.ok($('[data-detector-quote]').length);assert.ok($('[data-version-status=published]').length);assert.ok($('[data-version-status=draft]').length);
  const review=await page('/admin/aifind/review/'+id);assert.match(review.$('[data-detector-provenance]').text(),/aifind-resolver-v1|aifind-detector-v1/);assert.ok(review.$('[data-detector-quote]').length);
  const publicHtml=await (await fetch(origin+'/products/aifind-preview-detector-main')).text();assert.doesNotMatch(publicHtml,/proposalKey|observationId|detectorVersion|pending_review|2,800/);
});
