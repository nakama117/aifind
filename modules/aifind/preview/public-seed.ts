import { config } from "@aihot/backend/config";
import { sql } from "@aihot/backend/db";
import { assertPreviewWrites } from "./config.ts";
import { createProduct,createVendor,updateProductIdentity } from "../catalog/identity.ts";
import { createProductDraft,clonePublishedProduct,updateProductDraft } from "../catalog/versions.ts";
import { setProductMarket,setProductLanguageSupport,setProductPlatform,setProductCapability } from "../catalog/facts.ts";
import { createEvidence } from "../catalog/evidence.ts";
import { saveProductPlan,saveProductPrice } from "../catalog/pricing.ts";
import { publishProductVersion } from "../catalog/publish.ts";
import { setProductPublicVisibility } from "../catalog/public-settings.ts";

export const PUBLIC_PREVIEW_SLUGS = { a:"aifind-preview-public-a", b:"aifind-preview-public-b", c:"aifind-preview-public-c", d:"aifind-preview-public-d-current" };
export interface PublicPreviewFixture { aId:string; bId:string; cId:string; dId:string }

/** Explicit local/test CLI only; no API/Web/worker startup calls it. Later edits are never reseeded. */
export async function seedPublicPreview(): Promise<PublicPreviewFixture> {
  assertPreviewWrites({...process.env,DATABASE_URL:config.databaseUrl});
  const existing=await sql`SELECT id,slug,canonical_name FROM af_products WHERE slug IN ${sql(Object.values(PUBLIC_PREVIEW_SLUGS))}`;
  if(existing.length) {
    if(existing.length!==4 || existing.some(p=>!p.canonical_name.startsWith('[PREVIEW] Phase 3 '))) throw new Error('Public Preview collision/incomplete seed; use a fresh disposable database');
    return Object.fromEntries(Object.entries(PUBLIC_PREVIEW_SLUGS).map(([key,slug])=>[key+'Id',existing.find(p=>p.slug===slug)!.id])) as unknown as PublicPreviewFixture;
  }
  const vendor=await createVendor({slug:"aifind-preview-public-vendor",name:"[PREVIEW] デモベンダー",countryCode:"JP"});
  const evidence=await createEvidence({url:"https://preview.example.invalid/phase3/product",sourceKind:"official_product",title:"[PREVIEW] 製品・対応状況の説明",publisher:"Preview fixture",retrievedAt:"2026-10-06T00:00:00Z",evidenceNote:"INTERNAL_PREVIEW_NOTE 公開しない内部メモです。外部取得は行っていません。"});
  const pricing=await createEvidence({url:"https://preview.example.invalid/phase3/pricing",sourceKind:"official_pricing",title:"[PREVIEW] 合成料金表",publisher:"Preview fixture",retrievedAt:"2026-10-06T00:00:00Z",evidenceNote:"五つの料金タイプの表示例。実際の価格ではありません。"});
  const proof={evidenceId:evidence.id,verifiedAt:"2026-10-06T00:00:00Z"},priceProof={...proof,evidenceId:pricing.id};
  const ids: string[]=[];
  for(const key of ["a","b","c","d"] as const) {
    const slug=key==='d' ? 'aifind-preview-public-d-original' : PUBLIC_PREVIEW_SLUGS[key];
    const p=await createProduct({slug,canonicalName:`[PREVIEW] Phase 3 ${key.toUpperCase()}`,vendorId:vendor.id}); ids.push(p.id);
    const d=await createProductDraft(p.id,{displayName:`[PREVIEW] 製品 ${key.toUpperCase()}`,summaryJa:"文章作成とコードの補助を想定した合成デモです。実在する製品の情報・料金ではありません。",officialUrl:`https://preview.example.invalid/phase3/${key}`,lifecycleStatus:key==='d'?'discontinued':'active',lifecycleEvidenceId:proof.evidenceId,lifecycleVerifiedAt:proof.verifiedAt},"preview-fixture");
    await setProductMarket(p.id,d.version.id,{marketCode:"JP",availabilityStatus:key==='b'?'unknown':'available',...proof});
    await setProductLanguageSupport(p.id,d.version.id,{languageCode:"ja",inputSupport:"full",outputSupport:"partial",uiSupport:"unknown",...proof});
    await setProductPlatform(p.id,d.version.id,{platformKey:"web",status:"available",...proof});
    await setProductPlatform(p.id,d.version.id,{platformKey:"android",status:"unavailable",...proof});
    await setProductCapability(p.id,d.version.id,{capabilityKey:"text",supportLevel:"full",...proof});
    await setProductCapability(p.id,d.version.id,{capabilityKey:"coding",supportLevel:"partial",...proof});
    for(const [priceType,name,amountMinor,currencyCode,billingPeriod] of [
      ["free","無料プラン",0,null,"none"],["fixed","Pro",2000,"USD","month"],["from","チーム",3000,"JPY","month"],
      ["custom","企業向け",null,null,"custom"],["unknown","未確認プラン",null,null,"none"],
    ] as const) {
      const plan=await saveProductPlan(p.id,d.version.id,{planKey:`preview-${priceType}`,name});
      await saveProductPrice(p.id,d.version.id,plan.id,{priceType,amountMinor,currencyCode,billingPeriod,marketCode:"JP",unitLabel:priceType==='from'?'1ユーザー':null,...(priceType==='unknown'?{}:priceProof)});
    }
    await publishProductVersion(p.id,d.version.id,"preview-fixture","[PREVIEW] Phase 3 synthetic Published");
    if(key!=='c') {
      const [r]=await sql`SELECT identity_revision FROM af_products WHERE id=${p.id}`;
      await setProductPublicVisibility(p.id,{visibility:key==='b'?'unlisted':'listed',expectedRevision:r.identity_revision,reason:"[PREVIEW] Synthetic public visibility"},"preview-fixture");
    }
    if(key==='a') {
      const next=await clonePublishedProduct(p.id,"preview-fixture");
      await updateProductDraft(p.id,next.version.id,{summaryJa:"[DRAFT ONLY] 公開されない下書きの説明。",displayName:"[PREVIEW] 製品 A · Draft"});
      await setProductLanguageSupport(p.id,next.version.id,{languageCode:"ja",inputSupport:"full",outputSupport:"full",uiSupport:"full",...proof});
      const plan=next.plans.find(p=>p.planKey==='preview-fixed')!,price=plan.prices[0];
      await saveProductPrice(p.id,next.version.id,plan.id,{id:price.id,priceType:"fixed",amountMinor:9999,currencyCode:"USD",billingPeriod:"month",...priceProof});
    }
    if(key==='d') for(const next of ['aifind-preview-public-d-middle',PUBLIC_PREVIEW_SLUGS.d]) await sql.begin(tx=>updateProductIdentity(p.id,{slug:next,canonicalName:p.canonicalName,vendorId:vendor.id},tx));
  }
  return {aId:ids[0],bId:ids[1],cId:ids[2],dId:ids[3]};
}
