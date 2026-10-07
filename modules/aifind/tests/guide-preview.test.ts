import '../../../tests/setup.ts';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { sql, closeDb } from '@aihot/backend/db';
import { config } from '@aihot/backend/config';
import { installModules } from '@aihot/backend/modules';
import { SERVER_MODULES } from '@aihot/site/modules/server';
import { buildApp } from '../../../apps/api/src/app.ts';
import { seedGuidePreview } from '../preview/guide-seed.ts';
installModules(SERVER_MODULES);const app=await buildApp(),old={dev:config.devAdmin,password:config.adminPassword};config.devAdmin=null;config.adminPassword='synthetic-guide-preview-password';
const login=await app.inject({method:'POST',url:'/api/auth/password',headers:{'content-type':'application/x-www-form-urlencoded'},payload:'password=synthetic-guide-preview-password'}),cookie=String(login.headers['set-cookie']).split(';')[0],url='/api/admin/aifind/preview/howto-guide';
after(async()=>{config.devAdmin=old.dev;config.adminPassword=old.password;await app.close();await closeDb();});
test('Preview defaults and production reject seed; GET never seeds or publishes',async()=>{
  delete process.env.AIFIND_PREVIEW_ENABLED;await assert.rejects(seedGuidePreview);assert.equal((await app.inject({url,headers:{cookie}})).statusCode,404);
  process.env.AIFIND_PREVIEW_ENABLED='true';const saved=process.env.NODE_ENV;try{process.env.NODE_ENV='production';await assert.rejects(seedGuidePreview);}finally{process.env.NODE_ENV=saved;}
  assert.equal((await sql`SELECT count(*)::int n FROM af_products`)[0].n,0);assert.equal((await sql`SELECT count(*)::int n FROM af_editorial_documents`)[0].n,0);
  const r=await app.inject({url,headers:{cookie}});assert.equal(r.statusCode,200);assert.equal(r.json().documents.length,0);
});
test('Preview Hub and P01–P26 use real Domain; fixture Guides are Draft and assets unreviewed',async()=>{
  process.env.AIFIND_PREVIEW_ENABLED='true';assert.equal((await app.inject({url})).statusCode,401);
  await seedGuidePreview();const r=await app.inject({url,headers:{cookie}});assert.equal(r.statusCode,200,r.body);const d=r.json();
  assert.equal(d.documents.length,4);assert.equal(d.cases.length,26);assert.equal(d.seedOnRead,false);assert.equal(d.guides.length,0);
  for(const v of d.documents){assert.equal(v.type,'guide');assert.equal(v.published,null);assert.match(v.draft.content.title,/PREVIEW.*SYNTHETIC/);}
  const [a]=await sql`SELECT rights_basis,rights_reviewed_at,privacy_reviewed_at FROM af_editorial_assets`;assert.equal(a.rights_basis,'unreviewed');assert.equal(a.rights_reviewed_at,null);assert.equal(a.privacy_reviewed_at,null);
  const before=await sql`SELECT id,revision FROM af_editorial_documents ORDER BY id`;await seedGuidePreview();assert.deepEqual(await sql`SELECT id,revision FROM af_editorial_documents ORDER BY id`,before);
  const hub=(await app.inject({url:'/api/admin/aifind/preview',headers:{cookie}})).json();assert.ok(hub.previews.some((p:{path:string})=>p.path==='/admin/aifind/preview/howto-guide'));
  for(const path of ['/api/site/aifind/howto','/api/site/aifind/home','/sitemap-aifind-editorial.xml'])assert.doesNotMatch((await app.inject({url:path})).body,/aifind-preview-guide/);
});
