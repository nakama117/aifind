import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {sql,closeDb} from '@aihot/backend/db';
import {config} from '@aihot/backend/config';
import {installModules} from '@aihot/backend/modules';
import {SERVER_MODULES} from '@aihot/site/modules/server';
import {buildApp} from '../../../apps/api/src/app.ts';
import {seedDiscoveryPreview} from '../preview/discovery-seed.ts';
import {listPublicProducts} from '../publication/public-products.ts';
import {productSitemapXml} from '../publication/sitemap.ts';
installModules(SERVER_MODULES);const app=await buildApp(),saved={admin:config.devAdmin,password:config.adminPassword};config.devAdmin=null;config.adminPassword='discovery-test-password';
const login=await app.inject({method:'POST',url:'/api/auth/password',headers:{'content-type':'application/x-www-form-urlencoded'},payload:'password=discovery-test-password'});
const cookie=String(login.headers['set-cookie']).split(';')[0],csrf=(await app.inject({url:'/api/admin/me',headers:{cookie}})).json().csrf;
const endpoint='/api/admin/aifind/preview/product-discovery';
after(async()=>{config.devAdmin=saved.admin;config.adminPassword=saved.password;await app.close();await closeDb();});
test('Discovery Preview default/production flag never seeds; authenticated disabled endpoint is 404',async()=>{
  delete process.env.AIFIND_PREVIEW_ENABLED;assert.equal((await app.inject({url:endpoint,headers:{cookie}})).statusCode,404);
  await assert.rejects(()=>seedDiscoveryPreview());assert.equal((await sql`SELECT count(*)::int AS n FROM af_products`)[0].n,0);
  process.env.AIFIND_PREVIEW_ENABLED='true';const saved=process.env.NODE_ENV;try{process.env.NODE_ENV='production';await assert.rejects(()=>seedDiscoveryPreview());}finally{process.env.NODE_ENV=saved;}
  assert.equal((await sql`SELECT count(*)::int AS n FROM af_products`)[0].n,0);
});
test('Preview anonymous reads/actions are rejected, admin writes require CSRF and reads do not seed',async()=>{
  process.env.AIFIND_PREVIEW_ENABLED='true';
  for(const req of [{url:endpoint},{url:endpoint+'/pack',method:'POST' as const,payload:{action:'dry-run',example:'valid'}}])assert.equal((await app.inject(req)).statusCode,401);
  assert.equal((await app.inject({url:endpoint+'/pack',method:'POST',headers:{cookie},payload:{action:'import',example:'valid'}})).statusCode,403);
  const empty=await app.inject({url:endpoint,headers:{cookie}});assert.equal(empty.statusCode,200);assert.match(String(empty.headers['x-robots-tag']),/noindex/);assert.equal(empty.json().products.length,0);
  assert.equal((await sql`SELECT count(*)::int AS n FROM af_products`)[0].n,0);
});
test('Preview seeded cases are genuine Domain/Public API data; all P01-P23 registered; repeat seed preserves edits',async()=>{
  await seedDiscoveryPreview();const r=await app.inject({url:endpoint,headers:{cookie}}),d=r.json();assert.equal(r.statusCode,200);assert.equal(d.cases.length,23);
  assert.ok(d.products.length>=12);assert.deepEqual(d.discovery,await listPublicProducts({limit:6}));
  const q=await app.inject({url:'/api/site/aifind/products?capability=coding&limit=24'});assert.equal(q.statusCode,200);assert.ok(q.json().total>24);assert.equal(q.json().products.length,24);assert.equal(q.json().hasMore,true);
  const before=await sql`SELECT count(*)::int AS n FROM af_products`;await seedDiscoveryPreview();assert.deepEqual(await sql`SELECT count(*)::int AS n FROM af_products`,before);
  const hub=(await app.inject({url:'/api/admin/aifind/preview',headers:{cookie}})).json();assert.ok(hub.previews.some((p:any)=>p.path==='/admin/aifind/preview/product-discovery'));
  const map=await productSitemapXml();assert.doesNotMatch(map,/admin|\?capability|discovery-private|discovery-unlisted|discovery-import-only/);
});
test('Preview dry-run/import/repeat/error demonstrations use real guarded importer; Draft requires separate human Publish',async()=>{
  const post=(action:string,example='valid')=>app.inject({method:'POST',url:endpoint+'/pack',headers:{cookie,'x-csrf-token':csrf},payload:{action,example}});
  const dry=await post('dry-run');assert.equal(dry.statusCode,200);assert.equal(dry.json().products[0].state,'new');
  assert.equal((await post('import')).statusCode,200);assert.equal((await post('import')).json().products[0].state,'same');
  for(const example of ['missing-evidence','bad-money'])assert.equal((await post('dry-run',example)).json().valid,false);
  assert.equal((await post('dry-run','existing-conflict')).json().products[0].state,'conflict');
  const state=(await app.inject({url:endpoint,headers:{cookie}})).json();assert.equal(state.bootstrapProduct.published,null);assert.equal(state.bootstrapProduct.draft.version.status,'draft');assert.equal(state.bootstrapProduct.publicSettings.visibility,'private');
  assert.deepEqual((await listPublicProducts({q:'Import Only'})).products,[]);assert.equal((await app.inject({url:'/api/site/aifind/products/aifind-preview-discovery-import-only'})).statusCode,404);
});

test('S09 Site API rejects expanded Unicode and NUL with 400; valid normalization is idempotent',async()=>{
  const responses=[];
  for(const q of ['ﬃ'.repeat(100),'㍿'.repeat(60),'\u0000']){
    responses.push(await app.inject({url:'/api/site/aifind/products?q='+encodeURIComponent(q)}));
  }
  assert.deepEqual(responses.map(r=>r.statusCode),[400,400,400]);
  for(const response of responses)assert.equal(response.json().code,'invalid_query');
  assert.equal((await app.inject({url:'/api/site/aifind/products?q='+encodeURIComponent(' ＳＡＫＵＲＡ ')})).json().total,1);
});

test('Preview includes positive iOS and Android discovery cases, without treating unknown as available',async()=>{
  for(const platform of ['ios','android']){
    const result=await listPublicProducts({platform});assert.ok(result.total>0,platform);
    for(const product of result.products)assert.ok(product.platforms.some(p=>p.platformKey===platform&&p.status==='available'));
  }
});

test('Repeat seed detects incomplete Publish/visibility setup and preserves all existing work',async()=>{
  const [product]=await sql`SELECT id FROM af_products WHERE slug='aifind-preview-discovery-02'`;
  await sql`UPDATE af_products SET public_visibility='private' WHERE id=${product.id}`;
  try{
    await assert.rejects(()=>seedDiscoveryPreview(),/incomplete seed/i);
    assert.equal((await sql`SELECT public_visibility FROM af_products WHERE id=${product.id}`)[0].public_visibility,'private');
  }finally{await sql`UPDATE af_products SET public_visibility='listed' WHERE id=${product.id}`;}
});
