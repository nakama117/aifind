import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { closeDb } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { installModules } from '@aihot/backend/modules';
import { SERVER_MODULES } from '@aihot/site/modules/server';
import { buildApp } from '../../../apps/api/src/app.ts';
import { editorialContent, editorialReason as reason } from './editorial-fixtures.ts';
import { readEditorialAdmin } from '../editorial/read.ts';

installModules(SERVER_MODULES);
const app = await buildApp(), old = { password: config.adminPassword, dev: config.devAdmin };
config.devAdmin = null; config.adminPassword = 'synthetic-editorial-password';
const login = await app.inject({ method: 'POST', url: '/api/auth/password', headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'password=synthetic-editorial-password' });
assert.equal(login.statusCode,303);
const cookie = String(login.headers['set-cookie']).split(';')[0];
const csrf = (await app.inject({url:'/api/admin/me',headers:{cookie}})).json().csrf;
const headers={cookie,'x-csrf-token':csrf}, root='/api/admin/aifind';
after(async()=>{config.adminPassword=old.password;config.devAdmin=old.dev;await app.close();await closeDb();});

test('E13 every editorial Admin read/write/preview requires authentication, noindex and mutation CSRF', async()=>{
  for(const kind of ['compare','categories']) for(const [method,path] of [['GET',''],['POST',''],['GET','/missing'],['PATCH','/missing/draft'],['POST','/missing/draft'],['POST','/missing/publish'],['POST','/missing/withdraw'],['POST','/missing/restore'],['GET','/missing/preview']] as const){
    const url=`${root}/${kind}${path}`;
    const r=await app.inject({method,url,...(method==='GET'?{}:{payload:{}})});
    assert.equal(r.statusCode,401,url);assert.match(String(r.headers['x-robots-tag']),/noindex/);assert.match(String(r.headers['cache-control']),/no-store/);
    if(method!=='GET')assert.equal((await app.inject({method,url,headers:{cookie},payload:{}})).statusCode,403,url);
  }
  assert.equal((await app.inject({url:root+'/editorial/products'})).statusCode,401);
});
test('E01/E04/E11 Admin HTTP creates, previews real Product facts, saves with stale 409 and publishes saved Draft',async()=>{
  const {content}=await editorialContent();
  const create=await app.inject({method:'POST',url:root+'/compare',headers,payload:{content,reason}});
  assert.equal(create.statusCode,200,create.body);let d=create.json();
  assert.deepEqual(d,await readEditorialAdmin(d.id));
  const path=root+'/compare/'+d.id;
  const preview=await app.inject({url:path+'/preview',headers});assert.equal(preview.statusCode,200,preview.body);
  assert.equal(preview.json().preview.products[0].facts.slug.length>0,true);
  assert.equal(preview.json().preview.title,content.title);
  assert.equal((await readEditorialAdmin(d.id)).published,null,'Preview GET never publishes');
  const body={content:{...content,title:'保存済みの比較'},expectedRevision:d.revision,reason};
  const saved=await app.inject({method:'PATCH',url:path+'/draft',headers,payload:body});assert.equal(saved.statusCode,200,saved.body);d=saved.json();
  assert.equal((await app.inject({method:'PATCH',url:path+'/draft',headers,payload:body})).statusCode,409);
  const publish=await app.inject({method:'POST',url:path+'/publish',headers,payload:{expectedRevision:d.revision,reason}});
  assert.equal(publish.statusCode,200,publish.body);d=publish.json();assert.equal(d.published.content.title,'保存済みの比較');assert.equal(d.draft,null);
  assert.equal((await app.inject({url:root+'/categories/'+d.id,headers})).statusCode,404,'wrong subtype endpoint cannot read a document');
  const draft=await app.inject({method:'POST',url:path+'/draft',headers,payload:{expectedRevision:d.revision,reason}});assert.equal(draft.statusCode,200,draft.body);d=draft.json();
  const withdraw=await app.inject({method:'POST',url:path+'/withdraw',headers,payload:{expectedRevision:d.revision,reason}});assert.equal(withdraw.statusCode,200,withdraw.body);d=withdraw.json();
  const restore=await app.inject({method:'POST',url:path+'/restore',headers,payload:{expectedRevision:d.revision,sourceRevisionId:d.published.id,reason}});assert.equal(restore.statusCode,200,restore.body);
  assert.notEqual(restore.json().draft.id,d.published.id);
});
test('C04/CAT07 missing editorial prose or hands-on records return 422; choices exclude Product Draft versions',async()=>{
  const {content,products}=await editorialContent();if(content.type!=='comparison')throw new Error('fixture');content.comparison.mode='hands_on';
  const create=await app.inject({method:'POST',url:root+'/compare',headers,payload:{content,reason}});assert.equal(create.statusCode,200,create.body);
  const d=create.json(),path=root+'/compare/'+d.id;
  const result=await app.inject({method:'POST',url:path+'/publish',headers,payload:{expectedRevision:d.revision,reason}});assert.equal(result.statusCode,422,result.body);assert.match(result.body,/Test Record/);
  const choices=await app.inject({url:root+'/editorial/products',headers});assert.equal(choices.statusCode,200);
  const choice=choices.json().find((p:{productId:string})=>p.productId===products[0].product.id);assert.equal(choice.versions[0].id,products[0].published.version.id);
  assert.equal((await app.inject({method:'POST',url:root+'/categories',headers,payload:{content,reason}})).statusCode,400);
  assert.equal((await app.inject({url:root+'/compare/missing',headers})).statusCode,404);
});
