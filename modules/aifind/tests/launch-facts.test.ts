import '../../../tests/setup.ts';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {closeDb} from '@aihot/backend/db';
import {installModules} from '@aihot/backend/modules';
import {SERVER_MODULES} from '@aihot/site/modules/server';
import {buildApp} from '../../../apps/api/src/app.ts';
import {publicFixture} from './public-fixtures.ts';
import {setProductMarket,setProductLanguageSupport} from '../catalog/facts.ts';
import {saveProductPlan,saveProductPrice} from '../catalog/pricing.ts';
import {clonePublishedProduct,updateProductDraft} from '../catalog/versions.ts';
import {resolvePublicProductBySlug,projectPublicProduct} from '../publication/public-products.ts';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {planFactFingerprint,unknownFactFields,productFactCompletenessIssues} from '../launch/facts.ts';
import {evaluateLaunchChecks,evaluateLaunchGates,type LaunchSnapshot} from '../launch/preflight.ts';
installModules(SERVER_MODULES);const app=await buildApp();after(async()=>{await app.close();await closeDb();});
async function complete(f:Parameters<NonNullable<Parameters<typeof publicFixture>[1]>>[0],proof:Parameters<NonNullable<Parameters<typeof publicFixture>[1]>>[1],free=true){
 const args=[f.product.id,f.draft.version.id] as const;
 await setProductMarket(...args,{marketCode:'JP',availabilityStatus:'available',...proof});
 await setProductLanguageSupport(...args,{languageCode:'ja',inputSupport:'full',outputSupport:'full',uiSupport:'full',...proof});
 if(free){const plan=await saveProductPlan(...args,{planKey:'free',name:'Free',audience:'free',billingModel:'free',activeStatus:'active',...proof});await saveProductPrice(...args,plan.id,{priceType:'free',billingPeriod:'none',amountMinor:0,...proof});}
}
test('FC01 home excludes unknown Japan/UI/free core facts while directory and detail remain available',async()=>{
 const unknown=await publicFixture();
 const noFreeProof=await publicFixture('listed',(f,p)=>complete(f,p,false));
 const eligible=await publicFixture('listed',complete);
 const home=(await app.inject({url:'/api/site/aifind/home'})).json();
 assert.ok(home.products.some((p:{slug:string})=>p.slug===eligible.product.slug));
 assert.ok(!home.products.some((p:{slug:string})=>[unknown.product.slug,noFreeProof.product.slug].includes(p.slug)));
 for(const slug of [unknown.product.slug,noFreeProof.product.slug])assert.equal((await app.inject({url:'/api/site/aifind/products/'+slug})).statusCode,200);
});
test('FC02 changing a Draft to unknown does not remove its complete Published homepage card',async()=>{
 const f=await publicFixture('listed',complete),draft=await clonePublishedProduct(f.product.id,'test');
 await updateProductDraft(f.product.id,draft.version.id,{displayName:'PRIVATE FACT DRAFT'});
 await setProductLanguageSupport(f.product.id,draft.version.id,{languageCode:'ja',inputSupport:'unknown',outputSupport:'unknown',uiSupport:'unknown'});
 const result=(await app.inject({url:'/api/site/aifind/home'})).json();
 assert.ok(result.products.some((p:{slug:string})=>p.slug===f.product.slug));assert.doesNotMatch(JSON.stringify(result),/PRIVATE FACT DRAFT/);
});
test('FC03 public free-plan state is explicit and never infers paid from a missing free price',async()=>{
 const f=await publicFixture('listed',(f,p)=>complete(f,p,false));
 const result=await resolvePublicProductBySlug(f.product.slug);assert.equal(result.kind,'found');
 if(result.kind==='found')assert.equal((result.product as unknown as {freePlanState:string}).freePlanState,'unknown');
});
test('FC04 reviewed trial is distinct from permanent free and cannot leak across a pricing revision',async()=>{
 const f=await publicFixture('listed',(f,p)=>complete(f,p,false)),snapshot=f.published;
 const plans=snapshot.plans.map(p=>({planKey:p.planKey,name:p.name,audience:p.audience,billingModel:p.billingModel,activeStatus:p.activeStatus,
   prices:p.prices.map(r=>({priceType:r.priceType,billingPeriod:r.billingPeriod,amountMinor:r.amountMinor,currencyCode:r.currencyCode,marketCode:r.marketCode,unitLabel:r.unitLabel,validFrom:r.validFrom,validTo:r.validTo}))}));
 const proof=snapshot.evidence[0],dossier={productSlug:f.product.slug,lastVerified:snapshot.lastVerifiedAt,sources:[{url:proof.url,sourceKind:proof.sourceKind,access:'accessible',reviewedFacts:[{field:'free-plan-state',values:{state:'trial'}}]}],
   factReview:{checkedAt:snapshot.lastVerifiedAt,freePlanState:'trial',freePlanSourceUrl:proof.url,freePlanFingerprint:createHash('sha256').update(JSON.stringify(plans.sort((a,b)=>a.planKey.localeCompare(b.planKey)))).digest('hex'),unknown:[]}};
 const render=(d:unknown)=>projectPublicProduct(snapshot,'listed',d as never);
 assert.equal(render(dossier).freePlanState,'trial');assert.equal(render(dossier).hasCurrentFreePlan,false);
 const expired=structuredClone(snapshot);expired.plans=[{planKey:'free',name:'Expired free',audience:'free',billingModel:'free',activeStatus:'active',prices:[{priceType:'free',billingPeriod:'none',amountMinor:0,validFrom:'2000-01-01',validTo:'2000-01-31'}]}] as never;
 const free=structuredClone(dossier);free.factReview.freePlanState='free';free.factReview.freePlanFingerprint=planFactFingerprint(expired);free.sources[0].reviewedFacts[0].values.state='free';
 assert.equal(projectPublicProduct(expired,'listed',free as never).hasCurrentFreePlan,false);assert.equal(projectPublicProduct(expired,'listed',free as never).freePlanState,'unknown');
 const future=structuredClone(dossier);future.lastVerified='2999-01-01T00:00:00Z';future.factReview.checkedAt=future.lastVerified;assert.equal(render(future).freePlanState,'unknown');
 snapshot.plans.push({planKey:'different',name:'Changed',audience:'personal',billingModel:'subscription',activeStatus:'active',prices:[]} as never);
 assert.equal(render(dossier).freePlanState,'unknown');
});
test('FC05 every remaining unknown requires exact official-source audit with a valid check time',async()=>{
 const c=JSON.parse(await readFile(new URL('../../../site/launch/2026-10-07-corpus.json',import.meta.url),'utf8'));
 const p=c.pack.products[0],d=c.dossiers[0],at=d.lastVerified;
 d.sources.forEach((s:Record<string,unknown>)=>s.access='accessible');
 const source=d.sources.find((s:{role:string})=>s.role==='pricing');source.reviewedFacts.push({field:'free-plan-state',values:{state:'free'}});
 d.unknownFields=unknownFactFields(p,'free');
 d.factReview={checkedAt:at,freePlanState:'free',freePlanSourceUrl:source.url,freePlanFingerprint:planFactFingerprint(p),unknown:d.unknownFields.map((field:string)=>({field,checkedSources:d.sources.slice(0,2).map((s:{url:string})=>s.url),checkedAt:at,reasonStillUnknown:'Official product and help sources do not explicitly establish this specific field.'}))};
 assert.deepEqual(productFactCompletenessIssues(p,d),[]);
 const missing=structuredClone(d);missing.factReview.unknown=[];missing.unknownFields.push('platform:invented');assert.ok(productFactCompletenessIssues(p,missing).length);
 const wrong=structuredClone(d);wrong.factReview.unknown.push({field:'extra',checkedSources:['https://other-vendor.example/docs'],checkedAt:'2999-01-01T00:00:00Z',reasonStillUnknown:'not researched'});
 assert.ok(productFactCompletenessIssues(p,wrong).some(s=>/checked sources/.test(s)));assert.ok(productFactCompletenessIssues(p,wrong).some(s=>/audit time/.test(s)));
 p.plans[0].name+=' CHANGED';assert.ok(productFactCompletenessIssues(p,d).some(s=>/current facts/.test(s)));
});
test('FC06 launch fact completeness blocks unperformed checks and any undocumented unknown',()=>{
 const base={publicationPolicy:'source_backed',sourceBackedIssueCount:0,products:12,eligible:12,comparison:2,category:2,guide:2,externalEnabled:[],nodeVersion:process.versions.node,siteUrl:'http://localhost:4000'} as unknown as LaunchSnapshot;
 const check=(s:LaunchSnapshot)=>evaluateLaunchChecks(s).find(c=>c.id==='content.factCompleteness');
 assert.equal(check(base)?.status,'BLOCK');
 assert.equal(check({...base,factCompletenessIssueCount:1} as LaunchSnapshot)?.status,'BLOCK');
 assert.equal(check({...base,factCompletenessIssueCount:0} as LaunchSnapshot)?.status,'PASS');
 const complete={...base,factCompletenessIssueCount:0} as LaunchSnapshot;
 assert.equal(evaluateLaunchGates(complete).launchFactCompleteness,'READY');
 for(const incomplete of [{...complete,sourceBackedIssueCount:1},{...complete,sourceBackedIssueCount:undefined},{...complete,products:11,eligible:11},{...complete,products:12,eligible:11}])
  assert.equal(evaluateLaunchGates(incomplete).launchFactCompleteness,'NOT READY');
});
test('FC07 Firefly official first-year offers retain eligibility, contract, renewal and purchase window',async()=>{
 const c=JSON.parse(await readFile(new URL('../../../site/launch/2026-10-07-corpus.json',import.meta.url),'utf8'));
 const p=c.pack.products.find((p:{slug:string})=>p.slug==='adobe-firefly');
 for(const [key,amount,regular] of [['pro-plus',4617,6600],['premium',22162,31680]] as const){
  const prices=p.plans.find((p:{planKey:string})=>p.planKey===key).prices;
  const standard=prices.find((r:{amountMinor:number})=>r.amountMinor===regular);assert.ok(standard,'regular price preserved');
  assert.doesNotMatch(standard.unitLabel,/終了日と適用条件は未確認/,'normal price must not contradict the researched offer conditions');
  const offer=prices.find((r:{amountMinor:number})=>r.amountMinor===amount);assert.ok(offer,'current official offer');
  assert.equal(offer.currencyCode,'JPY');assert.equal(offer.billingPeriod,'month');
  assert.equal(offer.validFrom,'2026-07-09');assert.equal(offer.validTo,'2026-10-12');
  for(const condition of ['初年度','初回購入','12か月','通常料金','購入'])assert.ok(offer.unitLabel.includes(condition),condition);
  const evidence=c.pack.evidence.find((e:{key:string})=>e.key===offer.evidenceKey);
  assert.equal(evidence.url,'https://www.adobe.com/jp/offer-terms/ff-full-special-offer.html');
 }
});
test('FC08 ElevenLabs annual totals use official standard monthly times ten without introductory discounts',async()=>{
 const c=JSON.parse(await readFile(new URL('../../../site/launch/2026-10-07-corpus.json',import.meta.url),'utf8'));
 const p=c.pack.products.find((p:{slug:string})=>p.slug==='elevenlabs');
 for(const [key,total] of [['starter',60],['creator',220],['pro',990],['scale',2990],['business',9900]] as const){
  const price=p.plans.find((p:{planKey:string})=>p.planKey===key).prices.find((r:{billingPeriod:string})=>r.billingPeriod==='year');
  assert.ok(price,'official annual billing for '+key);assert.equal(price.amountMinor,total*100);
  assert.equal(price.currencyCode,'USD');assert.equal(price.priceType,'fixed');assert.match(price.unitLabel,/年払い|年額/);
  assert.match(price.unitLabel,/10か月/);assert.match(price.unitLabel,/初月/);
  assert.equal(c.pack.evidence.find((e:{key:string})=>e.key===price.evidenceKey).url,'https://elevenlabs.io/pricing');
 }
 assert.equal(p.plans.find((p:{planKey:string})=>p.planKey==='free').prices.some((r:{billingPeriod:string})=>r.billingPeriod==='year'),false);
});
test('FC09 Firefly creative agent and asset search are partial official features with public limits',async()=>{
 const c=JSON.parse(await readFile(new URL('../../../site/launch/2026-10-07-corpus.json',import.meta.url),'utf8'));
 const p=c.pack.products.find((p:{slug:string})=>p.slug==='adobe-firefly'),d=c.dossiers.find((d:{productSlug:string})=>d.productSlug===p.slug);
 for(const key of ['agent','search']){
  const f=p.capabilities.find((f:{capabilityKey:string})=>f.capabilityKey===key);assert.equal(f.supportLevel,'partial');
  assert.ok(c.pack.evidence.find((e:{key:string})=>e.key===f.evidenceKey)?.url.startsWith('https://helpx.adobe.com/jp/firefly/web/'));
  assert.equal(d.factReview.unknown.some((u:{field:string})=>u.field==='capability:'+key),false);
 }
 for(const limit of ['Beta','デスクトップWeb','18歳','英語','自分の素材'])assert.ok(p.draft.summaryJa.includes(limit),limit);
});
