import {CatalogPackSchema,type CatalogPack} from '../catalog-pack/contracts.ts';

export const DISCOVERY_PACK_ID='aifind-preview-discovery-v1';
export const BOOTSTRAP_SLUG='aifind-preview-discovery-import-only';
const names=['Sakura Writer','Kumo Coder','Mizu Image','Yoru Research','Hoshi Audio','Sora Video','Nami Agent','Mori Search','Kaze API','Tsuki Desktop','Umi Writer','Haru Coder'];
const jp=['available','available','unknown','restricted','waitlist','unavailable','available','available','unknown','available','available','available'];
const input=['full','full','partial','full','unknown','full','full','full','full','full','full','none'];
const output=['full','full','full','partial','unknown','full','full','unknown','full','full','full','none'];
const web=['available','available','available','available','unknown','unavailable','available','unknown','available','unavailable','available','available'];
const caps=['text','coding','image_generation','research','audio','video_generation','agent','search','api','coding','text','coding'];
const priceTypes=['free','free','fixed','custom','unknown','custom','free','fixed','free','fixed','unknown','unknown'];
export function discoveryPack():CatalogPack {
  const products=[],evidence=[];
  // 34 listed cases make both unfiltered and coding-filtered real pagination observable at 24/page.
  for(let i=0;i<36;i++){
    const key=i===34?'private':i===35?'unlisted':String(i+1).padStart(2,'0'),slug='aifind-preview-discovery-'+key;
    const name=i<12?names[i]:i===34?'Private Only':i===35?'Unlisted Only':`Catalog Sample ${i+1}`;
    const at=new Date(Date.UTC(2026,7,1+i)).toISOString(),proof={evidenceKey:key,verifiedAt:at};
    evidence.push({key,url:`https://preview.example.invalid/phase5/${key}`,title:`[PREVIEW] [SYNTHETIC] ${name} fixture`,publisher:'Synthetic Preview fixture',sourceKind:'official_product',retrievedAt:at,
      evidenceNote:'合成の表示・検索テスト専用です。実在する製品の根拠ではありません。外部取得は行っていません。'});
    // Evidence keys are slugs, including numeric keys; no production provider names/claims.
    const priceType=i<12?priceTypes[i]:'free',isFixed=priceType==='fixed';
    products.push({slug,canonicalName:'[PREVIEW] [SYNTHETIC] '+name,vendorKey:'aifind-preview-discovery-vendor-'+(i%3),
      aliases:[{alias:i===0?'さくらライター':i===1?'くもコーダー':`合成カタログ ${key}`,aliasType:'common',locale:'ja-JP'}],
      draft:{displayName:'[PREVIEW] [SYNTHETIC] '+name,summaryJa:'検索と対応状況の表示を確認する合成デモです。実在する製品・料金ではありません。',officialUrl:`https://preview.example.invalid/phase5/${key}`,lifecycleStatus:'active',...proof},
      markets:[{marketCode:'JP',availabilityStatus:i<12?jp[i]:'available',...proof}],
      languages:[{languageCode:'ja',inputSupport:i<12?input[i]:'full',outputSupport:i<12?output[i]:'full',uiSupport:i===5||i===6?'full':i===1?'partial':'unknown',...proof}],
      platforms:[{platformKey:'web',status:i<12?web[i]:'available',...proof},{platformKey:'ios',status:i===1?'available':i===0?'unavailable':'unknown',...proof},{platformKey:'android',status:i===3?'available':i===0?'unavailable':'unknown',...proof},...(i===9?[{platformKey:'windows',status:'available',...proof}]:[])],
      capabilities:[{capabilityKey:i<12?caps[i]:'coding',supportLevel:i===8?'partial':i===10?'partial':i===11?'none':'full',...proof},...(i===0?[{capabilityKey:'coding',supportLevel:'full',...proof}]:[])],
      plans:[{planKey:'demo',name:'[PREVIEW] [SYNTHETIC] Demo Plan',billingModel:priceType==='free'?'free':isFixed?'subscription':priceType==='custom'?'custom':'unknown',activeStatus:i===8?'inactive':'active',...proof,
        prices:[{key:'demo-component',priceType,amountMinor:priceType==='free'?0:isFixed?(i===2?2000:1500):null,currencyCode:isFixed?(i===2?'JPY':'USD'):null,billingPeriod:isFixed?'month':priceType==='custom'?'custom':'none',validFrom:'2000-01-01',validTo:i===6?'2000-12-31':'2099-12-31',...proof}]}],
      monitors:i<2?[{key:'product-page',url:`https://preview.example.invalid/phase5/${key}`,sourceKind:'official_product',publisher:'Synthetic Preview fixture',enabled:false,allowJina:false}]:[]});
  }
  return CatalogPackSchema.parse({schemaVersion:1,packId:DISCOVERY_PACK_ID,revision:1,dataKind:'synthetic',note:'LOCAL/TEST ONLY: SYNTHETIC fixtures; importer writes Draft, seed separately simulates human Publish.',
    vendors:[0,1,2].map(i=>({slug:'aifind-preview-discovery-vendor-'+i,name:`[PREVIEW] [SYNTHETIC] Preview Studio ${i+1}`,countryCode:i===1?'US':'JP'})),evidence,products});
}
export function bootstrapPack(example:'valid'|'missing-evidence'|'bad-money'|'existing-conflict'='valid'):unknown {
  const source=discoveryPack(),product=structuredClone(source.products[0]);
  product.slug=BOOTSTRAP_SLUG;product.canonicalName='[PREVIEW] [SYNTHETIC] Import Only';product.aliases=[];product.monitors=[];
  product.draft.displayName='[PREVIEW] [SYNTHETIC] Import Only';product.draft.summaryJa='Draft インポート専用。公開には管理者の別の Publish と visibility 設定が必要です。';
  const p={...source,packId:'aifind-preview-bootstrap-v1',vendors:[],evidence:[source.evidence[0]],products:[product]};
  if(example==='missing-evidence')p.evidence=[];
  if(example==='bad-money')product.plans[0].prices[0].amountMinor=1.5;
  if(example==='existing-conflict'){product.slug=source.products[0].slug;product.canonicalName=source.products[0].canonicalName;p.packId='aifind-preview-existing-conflict';}
  return p;
}
