import '../../../tests/setup.ts';
import assert from 'node:assert/strict';
import { after,test } from 'node:test';
import { sql,closeDb } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { installModules } from '@aihot/backend/modules';
import { SERVER_MODULES } from '@aihot/site/modules/server';
import { buildApp } from '../../../apps/api/src/app.ts';
const seed=async()=>{const m=await import('../preview/editorial-seed.ts').catch(()=>null);assert.ok(m,'explicit local Editorial seed exists');await m.seedEditorialPreview();};
installModules(SERVER_MODULES);const app=await buildApp(),old={dev:config.devAdmin,password:config.adminPassword};config.devAdmin=null;config.adminPassword='synthetic-editorial-preview';
const login=await app.inject({method:'POST',url:'/api/auth/password',headers:{'content-type':'application/x-www-form-urlencoded'},payload:'password=synthetic-editorial-preview'}),cookie=String(login.headers['set-cookie']).split(';')[0],url='/api/admin/aifind/preview/compare-category';
after(async()=>{config.devAdmin=old.dev;config.adminPassword=old.password;await app.close();await closeDb();});
test('P01/P13 Preview default and production never seed Products or Editorial, GET does not seed',async()=>{
  delete process.env.AIFIND_PREVIEW_ENABLED;assert.equal((await app.inject({url,headers:{cookie}})).statusCode,404);
  await assert.rejects(seed);process.env.AIFIND_PREVIEW_ENABLED='true';const saved=process.env.NODE_ENV;try{process.env.NODE_ENV='production';await assert.rejects(seed);}finally{process.env.NODE_ENV=saved;}
  assert.equal((await sql`SELECT count(*)::int n FROM af_products`)[0].n,0);assert.equal((await sql`SELECT count(*)::int n FROM af_editorial_documents`)[0].n,0);
  const empty=await app.inject({url,headers:{cookie}});assert.equal(empty.statusCode,200,empty.body);assert.equal(empty.json().documents.length,0);
});
test('P02/P11/P12/P14/P24 Preview reads real Domain and registers all 24 cases; seed creates only Editorial Drafts',async()=>{
  process.env.AIFIND_PREVIEW_ENABLED='true';assert.equal((await app.inject({url})).statusCode,401);
  await seed();const r=await app.inject({url,headers:{cookie}});assert.equal(r.statusCode,200,r.body);const d=r.json();assert.equal(d.cases.length,24);assert.equal(d.documents.length,3);
  assert.match(String(r.headers['x-robots-tag']),/noindex/);assert.match(String(r.headers['cache-control']),/no-store/);
  for(const doc of d.documents){assert.equal(doc.published,null);assert.ok(doc.draft);assert.match(doc.draft.content.title,/\[PREVIEW\].*\[SYNTHETIC\]/);}
  assert.equal((await sql`SELECT count(*)::int n FROM af_editorial_documents WHERE state='published'`)[0].n,0);
  const hub=(await app.inject({url:'/api/admin/aifind/preview',headers:{cookie}})).json();assert.ok(hub.previews.some((p:{path:string})=>p.path==='/admin/aifind/preview/compare-category'));
  const before=await sql`SELECT id,revision FROM af_editorial_documents ORDER BY id`;await seed();assert.deepEqual(await sql`SELECT id,revision FROM af_editorial_documents ORDER BY id`,before);
  for(const path of ['/sitemap-aifind-editorial.xml','/api/site/aifind/compare','/api/site/aifind/categories'])assert.doesNotMatch((await app.inject({url:path})).body,/aifind-preview-editorial/);
});
