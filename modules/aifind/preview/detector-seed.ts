import {config} from '@aihot/backend/config';
import {sql} from '@aihot/backend/db';
import {assertPreviewWrites} from './config.ts';
import {createVendor,createProduct,addProductAlias} from '../catalog/identity.ts';
import {createProductDraft} from '../catalog/versions.ts';
import {createEvidence} from '../catalog/evidence.ts';
import {setProductMarket,setProductLanguageSupport} from '../catalog/facts.ts';
import {saveProductPlan,saveProductPrice} from '../catalog/pricing.ts';
import {publishProductVersion} from '../catalog/publish.ts';
import {setProductPublicVisibility} from '../catalog/public-settings.ts';
import {createMonitor} from '../detector/monitors.ts';
import {detectorPreviewSeed,PHASE4_SETTING} from './detector-fixtures.ts';
import type {DetectorPreviewSeed} from './detector-fixtures.ts';

/** Explicit local CLI/fixture only. This function is never called by server/worker startup. */
export async function seedDetectorPreview():Promise<DetectorPreviewSeed> {
  assertPreviewWrites({...process.env,DATABASE_URL:config.databaseUrl});
  const existing=await detectorPreviewSeed();if(existing)return existing;
  if((await sql`SELECT id FROM af_products WHERE slug LIKE 'aifind-preview-detector-%'`).length)throw new Error('Incomplete/colliding Phase 4 seed; use a fresh disposable database. Existing work will not be overwritten.');
  const vendor=await createVendor({slug:'aifind-preview-detector-vendor',name:'[PREVIEW] 合成デモベンダー',countryCode:'JP'});
  const evidence=await createEvidence({url:'https://synthetic.invalid/aifind-phase4/baseline',sourceKind:'official_product',publisher:'[PREVIEW] Synthetic fixture',retrievedAt:'2026-10-06T00:00:00Z',evidenceNote:'合成 Preview fixture。実在する製品・料金の事実ではありません。'});
  const proof={evidenceId:evidence.id,verifiedAt:'2026-10-06T00:00:00Z'},ids:Record<string,string>={},prices:Record<string,string>={};
  for(const [key,name] of [['main','[PREVIEW] Phase 4 AI デモ'],['ms','[PREVIEW] Phase 4 Microsoft Copilot'],['gh','[PREVIEW] Phase 4 GitHub Copilot'],['stale','[PREVIEW] Phase 4 基準版デモ']] as const){
    const p=await createProduct({slug:'aifind-preview-detector-'+key,canonicalName:name,vendorId:vendor.id});ids[key]=p.id;
    if(key==='ms'||key==='gh')await addProductAlias(p.id,{alias:'Copilot',aliasType:'common',locale:'en'});
    const d=await createProductDraft(p.id,{displayName:name,summaryJa:'価格と日本語対応を確認する合成デモです。実在する製品の情報ではありません。',officialUrl:'https://synthetic.invalid/aifind-phase4/'+key},'preview-human-fixture');
    await setProductMarket(p.id,d.version.id,{marketCode:'JP',availabilityStatus:'available',...proof});
    await setProductLanguageSupport(p.id,d.version.id,{languageCode:'ja',inputSupport:'full',outputSupport:'partial',uiSupport:'unknown',...proof});
    const plan=await saveProductPlan(p.id,d.version.id,{planKey:'plus',name:'Plus',billingModel:'subscription',activeStatus:'active',...proof});
    const price=await saveProductPrice(p.id,d.version.id,plan.id,{marketCode:'JP',currencyCode:'JPY',billingPeriod:'month',priceType:'fixed',amountMinor:2400,unitLabel:'user',validFrom:null,validTo:null,...proof});prices[key]=price.id;
    // Initial synthetic V1 is fixture setup, separate from all observe/detect jobs.
    await publishProductVersion(p.id,d.version.id,'preview-human-fixture','[PREVIEW] Initial Published V1 fixture');
  }
  const [r]=await sql`SELECT identity_revision FROM af_products WHERE id=${ids.main}`;
  await setProductPublicVisibility(ids.main,{visibility:'listed',expectedRevision:r.identity_revision,reason:'[PREVIEW] Public Reader isolation demonstration'},'preview-human-fixture');
  const fixtures:DetectorPreviewSeed['fixtures']=[];
  for(const key of ['main','ambiguous','stale','stale_commit'] as const){
    const productKey=key==='stale_commit'?'stale':key,productId=key==='ambiguous'?null:ids[productKey];
    const identityHint=key==='ambiguous'?'Copilot':key==='main'?'[PREVIEW] Phase 4 AI デモ':'[PREVIEW] Phase 4 基準版デモ';
    const m=await createMonitor({productId,url:'https://synthetic.invalid/aifind-phase4/'+key,sourceKind:'official_pricing',publisher:'[PREVIEW] Synthetic fixture',identityHint,enabled:false,reason:'[PREVIEW] Explicit synthetic source registration'},'preview-human-fixture');
    const value={marketCode:'JP',currencyCode:'JPY',billingPeriod:'month',priceType:'fixed',amountMinor:2800,unitLabel:'user',validFrom:null,validTo:null};
    const text=key==='ambiguous'?'Copilot\n{}':identityHint+'\n'+JSON.stringify({candidateType:'price',targetKey:'plus',targetRef:prices[productKey],value})+'\n'+JSON.stringify({plan:'plus',...value});
    fixtures.push({key,monitorId:m.id,text});
  }
  const seed={products:{main:ids.main,ambiguous:[ids.ms,ids.gh],stale:ids.stale},fixtures};
  await sql`INSERT INTO settings(key,value) VALUES(${PHASE4_SETTING},${sql.json(seed)})`;
  return seed;
}
