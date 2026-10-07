import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sql} from '@aihot/backend/db';
import {Conflict} from '@aihot/backend/audit';
import {readAdminProduct} from '../admin/read.ts';
import {updateProductDraft} from '../catalog/versions.ts';
import {getPublishedProductBySlug} from '../publication/products.ts';
import {listPublicProducts} from '../publication/public-products.ts';
import {publishedFixture} from './admin-fixtures.ts';
import {publicFixture} from './public-fixtures.ts';
import {saveProductPlan,saveProductPrice} from '../catalog/pricing.ts';
import {updateProductIdentity} from '../catalog/identity.ts';
import {inspectCatalogPack,importCatalogPack,assertCatalogWrites} from '../catalog-pack/import.ts';
after(()=>sql.end());
function pack(){const key='pack-'+randomUUID();return{schemaVersion:1,packId:key,revision:1,dataKind:'synthetic',note:'SYNTHETIC TEST ONLY',vendors:[{slug:key,name:'[SYNTHETIC] Vendor'}],
  evidence:[{key:'product',url:'https://synthetic.example/'+key,publisher:'Synthetic Publisher',sourceKind:'official_product',retrievedAt:'2026-10-06T00:00:00Z',evidenceNote:'Not real product evidence'}],
  products:[{slug:key,canonicalName:'[SYNTHETIC] '+key,vendorKey:key,aliases:[{alias:key+' alias',aliasType:'common'}],
    draft:{displayName:'[SYNTHETIC] '+key,summaryJa:'テスト専用の合成製品です。',officialUrl:'https://synthetic.example/'+key,lifecycleStatus:'active',evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z'},
    markets:[{marketCode:'JP',availabilityStatus:'available',evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z'}],
    languages:[{languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'unknown',evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z'}],
    platforms:[{platformKey:'web',status:'available',evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z'}],capabilities:[{capabilityKey:'coding',supportLevel:'full',evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z'}],
    plans:[{planKey:'free',name:'Free',billingModel:'free',activeStatus:'active',evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z',prices:[{key:'free-jp',marketCode:'JP',currencyCode:'JPY',billingPeriod:'none',priceType:'free',amountMinor:0,evidenceKey:'product',verifiedAt:'2026-10-06T01:00:00Z'}]}],
    monitors:[{key:'product-page',url:'https://synthetic.example/'+key,sourceKind:'official_product',publisher:'Synthetic'}]}]};}
async function counts(){const tables=['af_vendors','af_products','af_product_versions','af_product_aliases','af_evidence','af_product_markets','af_product_language_support','af_product_platforms','af_product_capabilities','af_product_plans','af_product_prices','af_source_monitors','af_catalog_imports','af_catalog_evidence'];return Promise.all(tables.map(async t=>({table:t,n:(await sql`SELECT count(*)::int AS n FROM ${sql(t)}`)[0].n})));}
test('I01/I02/I03/I04/I05/I14 strict pack rejects fields/enums/Evidence/money/URL errors before any writes',async()=>{
  const good=pack();assert.equal((await inspectCatalogPack(good)).valid,true);
  const invalid=[{...good,schemaVersion:2},{...good,extra:true}];
  for(const mutate of [
    (p:any)=>p.products[0].capabilities[0].supportLevel='supported',
    (p:any)=>p.products[0].markets[0].evidenceKey='missing',
    (p:any)=>delete p.products[0].languages[0].verifiedAt,
    (p:any)=>p.products[0].plans[0].prices[0].amountMinor=1.5,
    (p:any)=>p.products[0].plans[0].prices[0].priceType='unknown',
    (p:any)=>p.products[0].plans[0].prices[0].currencyCode='BTC',
    (p:any)=>p.evidence[0].url='https://user:password@example.com',
    (p:any)=>p.evidence[0].url='http://127.0.0.1/pricing',
    (p:any)=>p.products[0].monitors[0].enabled=true,
  ]){const p=structuredClone(good);mutate(p);invalid.push(p);}
  const before=await counts();for(const p of invalid){const r=await inspectCatalogPack(p);assert.equal(r.valid,false,JSON.stringify(p));assert.ok(r.errors.length);await assert.rejects(()=>importCatalogPack(p,'test-importer'));}
  assert.deepEqual(await counts(),before);
});
test('I12 dry-run reports new Vendor/Product/Evidence/disabled Monitor and changes zero rows',async()=>{
  const before=await counts(),r=await inspectCatalogPack(pack());assert.equal(r.valid,true);assert.equal(r.products[0].state,'new');assert.equal(r.vendors[0].state,'new');assert.equal(r.evidenceCount,1);assert.equal(r.monitorCount,1);assert.deepEqual(await counts(),before);
});
test('I06/I07/I11/I13/I15 atomic import, retry and concurrent repeats create one private Draft and disabled Monitor only',async()=>{
  const p=pack(),results=await Promise.all([importCatalogPack(p,'test'),importCatalogPack(p,'test')]);
  assert.equal(results[0].products[0].productId,results[1].products[0].productId);
  const first=results[0].products[0],d=await readAdminProduct(first.productId!);assert.equal(d.published,null);assert.equal(d.draft!.version.status,'draft');assert.equal(d.publicSettings.visibility,'private');
  const before=await counts();for(let i=0;i<3;i++)await importCatalogPack(p,'test');assert.deepEqual(await counts(),before);
  assert.equal((await inspectCatalogPack(p)).products[0].state,'same');assert.equal(await getPublishedProductBySlug(p.products[0].slug),null);
  assert.deepEqual((await listPublicProducts({q:p.products[0].canonicalName})).products,[]);
  const monitors=await sql`SELECT enabled,allow_jina FROM af_source_monitors WHERE product_id=${first.productId!}`;assert.equal(monitors.length,1);assert.equal(monitors[0].enabled,false);assert.equal(monitors[0].allow_jina,false);
});
test('I08 Alias collision across Products rejects the whole pack rather than reassignment or duplication',async()=>{
  const a=pack(),b=pack();await importCatalogPack(a,'test');b.products[0].aliases=a.products[0].aliases;
  const before=await counts(),r=await inspectCatalogPack(b);assert.equal(r.products[0].state,'conflict');await assert.rejects(()=>importCatalogPack(b,'test'));assert.deepEqual(await counts(),before);
});
test('I09 manual edit of an imported Draft causes 409 conflict and preserves human work',async()=>{
  const p=pack(),r=await importCatalogPack(p,'test'),d=await readAdminProduct(r.products[0].productId!);
  await updateProductDraft(d.identity.id,d.draft!.version.id,{displayName:'HUMAN EDIT'});
  const before=await counts();assert.equal((await inspectCatalogPack(p)).products[0].state,'conflict');await assert.rejects(()=>importCatalogPack(p,'test'),Conflict);
  assert.equal((await readAdminProduct(d.identity.id)).draft!.version.displayName,'HUMAN EDIT');assert.deepEqual(await counts(),before);
});
test('I10 existing Published requires explicit current base, creates separate Draft and never changes Published',async()=>{
  const f=await publishedFixture(),p=pack();p.products[0].slug=f.product.slug;p.products[0].canonicalName=f.product.canonicalName;p.vendors=[];p.products[0].vendorKey='';p.products[0].monitors=[];p.products[0].aliases=[];
  const [v]=await sql`SELECT slug FROM af_vendors WHERE id=${f.vendor.id}`;p.products[0].vendorKey=v.slug;
  const before=await getPublishedProductBySlug(f.product.slug),state=await readAdminProduct(f.product.id);
  assert.equal((await inspectCatalogPack(p)).products[0].state,'conflict');
  Object.assign(p.products[0],{base:{expectedIdentityRevision:state.identityRevision,publishedVersionId:state.published!.version.id}});
  const r=await importCatalogPack(p,'test');assert.equal(r.products[0].productId,f.product.id);assert.deepEqual(await getPublishedProductBySlug(f.product.slug),before);
  assert.match((await readAdminProduct(f.product.id)).draft!.version.displayName,/SYNTHETIC/);
});
test('Pack identity cannot be reused with changed payload; Evidence content identity is reused across packs',async()=>{
  const a=pack(),b=pack();await importCatalogPack(a,'test');b.evidence=a.evidence;await importCatalogPack(b,'test');
  const [row]=await sql`SELECT count(*)::int AS n FROM af_evidence WHERE url=${a.evidence[0].url}`;assert.equal(row.n,1);
  a.products[0].draft.summaryJa='Changed payload';await assert.rejects(()=>importCatalogPack(a,'test'));
});
test('A database failure after facts, Evidence and Monitor rolls back the entire import transaction',async()=>{
  const p=pack(),before=await counts();
  await sql`CREATE FUNCTION af_test_reject_pack_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic final receipt failure'; END $$`;
  await sql`CREATE TRIGGER af_test_reject_pack_receipt BEFORE INSERT ON af_catalog_imports FOR EACH ROW EXECUTE FUNCTION af_test_reject_pack_receipt()`;
  try{await assert.rejects(()=>importCatalogPack(p,'test'),/synthetic final receipt failure/);assert.deepEqual(await counts(),before);}
  finally{await sql`DROP TRIGGER af_test_reject_pack_receipt ON af_catalog_imports`;await sql`DROP FUNCTION af_test_reject_pack_receipt()`;}
  await importCatalogPack(p,'test');assert.equal((await inspectCatalogPack(p)).products[0].state,'same');
});
test('Explicit Published price lineage replaces one cloned component, and two pack keys cannot target the same base price',async()=>{
  const f=await publicFixture('listed',async(f,proof)=>{const plan=await saveProductPlan(f.product.id,f.draft.version.id,{planKey:'free',name:'Old Free',activeStatus:'active',...proof});await saveProductPrice(f.product.id,f.draft.version.id,plan.id,{priceType:'free',amountMinor:0,billingPeriod:'none',...proof});});
  const p=pack(),state=await readAdminProduct(f.product.id);Object.assign(p.products[0],{slug:f.product.slug,canonicalName:f.product.canonicalName,aliases:[],monitors:[],base:{expectedIdentityRevision:state.identityRevision,publishedVersionId:state.published!.version.id}});
  p.vendors=[];p.products[0].vendorKey=(await sql`SELECT slug FROM af_vendors WHERE id=${f.vendor.id}`)[0].slug;
  const price=state.published!.plans[0].prices[0];Object.assign(p.products[0].plans[0].prices[0],{basePriceId:price.id});
  const bad=structuredClone(p);bad.products[0].plans[0].prices.push({...bad.products[0].plans[0].prices[0],key:'second-key'});
  assert.equal((await inspectCatalogPack(bad)).valid,false,'one price target cannot represent two pack components');
  const before=await getPublishedProductBySlug(f.product.slug);await importCatalogPack(p,'test');const d=await readAdminProduct(f.product.id);
  assert.equal(d.draft!.plans[0].prices.length,1);assert.deepEqual(await getPublishedProductBySlug(f.product.slug),before);
  assert.equal((await sql`SELECT base_price_id FROM af_product_prices WHERE id=${d.draft!.plans[0].prices[0].id}`)[0].base_price_id,price.id);
});
test('Dry-run identifies a historical slug reservation without writes',async()=>{
  const f=await publicFixture(),old=f.product.slug;await sql.begin(tx=>updateProductIdentity(f.product.id,{slug:old+'-renamed',canonicalName:f.product.canonicalName,vendorId:f.vendor.id},tx));
  const p=pack();p.products[0].slug=old;assert.equal((await inspectCatalogPack(p)).products[0].state,'conflict');
});
test('Default and production guards forbid non-disposable databases regardless of Preview flag',()=>{
  for(const env of [{},{DATABASE_URL:'postgres://postgres@127.0.0.1/prod'},{DATABASE_URL:'postgres://host/x_test'},{DATABASE_URL:'postgres://127.0.0.1/x_test?database=prod'},{DATABASE_URL:'postgres://127.0.0.1/x_test',NODE_ENV:'production'}])assert.throws(()=>assertCatalogWrites(env));
  assert.doesNotThrow(()=>assertCatalogWrites({DATABASE_URL:'postgres://127.0.0.1/x_test'}));
});
