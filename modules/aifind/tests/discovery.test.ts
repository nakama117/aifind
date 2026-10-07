import '../../../tests/setup.ts';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {sql} from '@aihot/backend/db';
import {listPublicProducts} from '../publication/public-products.ts';
import {publicFixture} from './public-fixtures.ts';
import {updateProductDraft,clonePublishedProduct} from '../catalog/versions.ts';
import {updateProductIdentity,updateVendor,addProductAlias} from '../catalog/identity.ts';
import {setProductMarket,setProductLanguageSupport,setProductPlatform,setProductCapability} from '../catalog/facts.ts';
import {saveProductPlan,saveProductPrice} from '../catalog/pricing.ts';
import {DiscoveryQuerySchema} from '../discovery/contracts.ts';

const prefix='discovery-test';
const fixtures:Awaited<ReturnType<typeof publicFixture>>[]=[];
before(async()=>{
  for(let i=0;i<6;i++) {
    const f=await publicFixture(i===4?'private':i===5?'unlisted':'listed',async(f,p)=>{
      const proof={...p,verifiedAt:`2020-01-0${i+1}T00:00:00Z`};
      await updateProductDraft(f.product.id,f.draft.version.id,{displayName:`Published ${prefix} ${i}`,summaryJa:'検索用の合成製品'});
      await setProductMarket(f.product.id,f.draft.version.id,{marketCode:'JP',availabilityStatus:i===0?'available':i===1?'restricted':'unknown',...proof});
      await setProductLanguageSupport(f.product.id,f.draft.version.id,{languageCode:'ja',inputSupport:i===2?'unknown':'full',outputSupport:i===1?'partial':i===2?'unknown':'full',uiSupport:'unknown',...proof});
      await setProductPlatform(f.product.id,f.draft.version.id,{platformKey:'web',status:i===1?'unavailable':i===2?'unknown':'available',...proof});
      await setProductCapability(f.product.id,f.draft.version.id,{capabilityKey:'coding',supportLevel:i===0||i===3?'full':i===1?'partial':'unknown',...proof});
      const plan=await saveProductPlan(f.product.id,f.draft.version.id,{planKey:'test',name:'Test',activeStatus:'active',...proof});
      await saveProductPrice(f.product.id,f.draft.version.id,plan.id,i===2?{priceType:'unknown',amountMinor:null,billingPeriod:'none'}:{priceType:'free',amountMinor:0,billingPeriod:'none',validTo:i===1?'2000-01-01':null,...proof});
    });
    await sql.begin(tx=>updateProductIdentity(f.product.id,{slug:`${prefix}-${i}`,canonicalName:`Canonical ${prefix} ${i}`,vendorId:f.vendor.id},tx));
    await updateVendor(f.vendor.id,{name:`Vendor ${prefix} ${i}`});
    await addProductAlias(f.product.id,{alias:`エイリアス ${prefix} ${i}`,aliasType:'common'});
    fixtures.push(f);
  }
  const draft=await clonePublishedProduct(fixtures[0].product.id,'test');
  await updateProductDraft(fixtures[0].product.id,draft.version.id,{displayName:'SECRET_DRAFT_NAME',summaryJa:'SECRET_DRAFT_SUMMARY'});
});
after(()=>sql.end());
const list=(input:Record<string,unknown>)=>listPublicProducts(input);
const slugs=(r:Awaited<ReturnType<typeof list>>)=>r.products.map(p=>p.slug);

test('S01/S02/S03/S04/S08 canonical, Published name, aliases and Vendor use trimmed NFKC case-insensitive literal search',async()=>{
  for(const q of [`canonical ${prefix} 0`,`published ${prefix} 0`,`エイリアス ${prefix} 0`,`vendor ${prefix} 0`,` ＣＡＮＯＮＩＣＡＬ ${prefix} 0 `]) {
    const result=await list({q});assert.deepEqual(slugs(result),[prefix+'-0'],q);
    assert.equal(Object.hasOwn(result.products[0],'aliases'),false);assert.equal(Object.hasOwn(result.products[0],'id'),false);
  }
  assert.deepEqual(slugs(await list({q:'%'})),[],'SQL wildcard is a literal');
});
test('S05/S06/S07 Draft, private and unlisted names cannot leak into public discovery',async()=>{
  for(const q of ['SECRET_DRAFT_NAME','SECRET_DRAFT_SUMMARY',`${prefix} 4`,`${prefix} 5`]) assert.deepEqual(slugs(await list({q})),[],q);
});
test('F01/F02 capability is full only, never partial or unknown',async()=>{
  assert.deepEqual(slugs(await list({q:prefix,capability:'coding',sort:'name'})),[prefix+'-0',prefix+'-3']);
});
test('F03/F04 platform requires available, not unavailable/unknown',async()=>{
  assert.deepEqual(slugs(await list({q:prefix,platform:'web',sort:'name'})),[prefix+'-0',prefix+'-3']);
});
test('F05/F06 JP available excludes restricted and unknown',async()=>{
  assert.deepEqual(slugs(await list({q:prefix,japan:'available'})),[prefix+'-0']);
});
test('F07/F08 Japanese usable requires full input AND output and does not require Japanese UI',async()=>{
  assert.deepEqual(slugs(await list({q:prefix,japanese:'usable',sort:'name'})),[prefix+'-0',prefix+'-3']);
  assert.equal((await list({q:`${prefix} 0`,japanese:'usable'})).products[0].japanese.uiSupport,'unknown');
});
test('F09/F10 free is active current free price, never expired/unknown',async()=>{
  assert.deepEqual(slugs(await list({q:prefix,free:'true',sort:'name'})),[prefix+'-0',prefix+'-3']);
  for(const p of (await list({q:prefix,free:'true'})).products)assert.equal(p.hasCurrentFreePlan,true);
});
test('F11/F12 AND filters run before pagination and report filtered total even after the last page',async()=>{
  const query={q:prefix,capability:'coding',platform:'web',japanese:'usable',free:'true',limit:1,sort:'name'};
  const a=await list(query),b=await list({...query,offset:1}),c=await list({...query,offset:2});
  assert.deepEqual(slugs(a),[prefix+'-0']);assert.deepEqual(slugs(b),[prefix+'-3']);assert.deepEqual(slugs(c),[]);
  assert.equal((a as {total?:number}).total,2);assert.equal((c as {total?:number}).total,2);assert.equal(a.hasMore,true);assert.equal(b.hasMore,false);
  assert.deepEqual(slugs(await list({...query,japan:'available'})),[prefix+'-0']);
});
test('S10 name/verified/published sorts are deterministic and use Published facts only',async()=>{
  const name=await list({q:prefix,sort:'name'});assert.deepEqual(slugs(name),[0,1,2,3].map(i=>prefix+'-'+i));
  const verified=await list({q:prefix,sort:'recently_verified'});assert.deepEqual(slugs(verified),[3,2,1,0].map(i=>prefix+'-'+i));
  const published=await list({q:prefix,sort:'recently_published'});assert.deepEqual(slugs(published),[3,2,1,0].map(i=>prefix+'-'+i));
  assert.deepEqual(await list({q:prefix}),await list({q:prefix}));
});
test('S09 invalid and unknown query values are rejected rather than silently broadened',async()=>{
  for(const input of [{capability:'fake'},{platform:'nintendo'},{japan:'yes'},{japanese:'yes'},{free:'yes'},{sort:'popular'},{q:'x'.repeat(201)},{q:'ﬃ'.repeat(100)},{q:'\u0000'},{limit:0},{extra:'x'}]) await assert.rejects(()=>list(input));
});
test('S09 Unicode query normalization remains valid when the public contract is parsed again',()=>{
  for(const q of [' ＳＡＫＵＲＡ ','ﬃ'.repeat(60),'㍿'.repeat(40),'さくらライター']){
    const parsed=DiscoveryQuerySchema.parse({q});assert.deepEqual(DiscoveryQuerySchema.parse(parsed),parsed);
    assert.ok(parsed.q.length<=200);assert.equal(parsed.q,q.trim().normalize('NFKC').toLowerCase());
  }
});
