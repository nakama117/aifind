import {z} from 'zod';
import {isIP} from 'node:net';
import {isBlockedAddress} from '@aihot/backend/lib/url';
import {VendorSchema,AliasSchema,DraftSchema,EvidenceSchema,MarketSchema,LanguageSupportSchema,PlatformSchema,CapabilitySchema,PlanSchema,PriceSchema,SlugSchema,NameSchema,TimestampSchema,SOURCE_KINDS} from '../contracts.ts';
import {normalizeAlias} from '../catalog/normalize.ts';

const key=SlugSchema,proof={evidenceId:z.never().optional(),evidenceKey:key.nullable().optional()};
const Price=PriceSchema.safeExtend({...proof,id:z.never().optional(),key,basePriceId:z.string().min(1).max(80).optional()});
const Plan=PlanSchema.safeExtend({...proof,prices:z.array(Price).max(50).default([])});
const Draft=DraftSchema.safeExtend({lifecycleEvidenceId:z.never().optional(),lifecycleVerifiedAt:z.never().optional(),evidenceKey:key.nullable().optional(),verifiedAt:TimestampSchema.nullable().optional()});
const Monitor=z.strictObject({key,url:EvidenceSchema.shape.url,sourceKind:z.enum(SOURCE_KINDS),publisher:NameSchema,
  enabled:z.literal(false).default(false),allowJina:z.literal(false).default(false),cadenceMinutes:z.number().int().min(60).max(43200).default(1440)});
const Product=z.strictObject({slug:SlugSchema,canonicalName:NameSchema,vendorKey:key.nullable().optional(),aliases:z.array(AliasSchema).max(50).default([]),draft:Draft,
  base:z.strictObject({expectedIdentityRevision:z.number().int().min(1),publishedVersionId:z.string().min(1).max(80)}).optional(),
  markets:z.array(MarketSchema.safeExtend(proof)).max(2).default([]),languages:z.array(LanguageSupportSchema.safeExtend(proof)).max(2).default([]),
  platforms:z.array(PlatformSchema.safeExtend(proof)).max(7).default([]),capabilities:z.array(CapabilitySchema.safeExtend(proof)).max(10).default([]),
  plans:z.array(Plan).max(30).default([]),monitors:z.array(Monitor).max(20).default([])});

export function validCatalogUrl(text:string):boolean {
  try{const u=new URL(text),host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password
    &&host!=='localhost'&&!host.endsWith('.localhost')&&!host.endsWith('.internal')&&!(isIP(host)&&isBlockedAddress(host));}catch{return false;}
}
export const CatalogPackSchema=z.strictObject({schemaVersion:z.literal(1),packId:key,revision:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  dataKind:z.enum(['synthetic','source_material']),note:z.string().trim().min(1).max(500),
  vendors:z.array(VendorSchema).max(200).default([]),evidence:z.array(EvidenceSchema.safeExtend({key})).max(2000),products:z.array(Product).min(1).max(200),
}).superRefine((p,ctx)=>{
  const error=(path:(string|number)[],message:string)=>ctx.addIssue({code:'custom',path,message});
  function unique(values:string[],path:(string|number)[]){const seen=new Set<string>();for(const [i,v]of values.entries()){if(seen.has(v))error([...path,i],`duplicate identity: ${v}`);seen.add(v);}}
  unique(p.vendors.map(v=>v.slug),['vendors']);unique(p.evidence.map(e=>e.key),['evidence']);unique(p.products.map(v=>v.slug),['products']);
  const evidence=new Set(p.evidence.map(e=>e.key)),aliases=new Map<string,string>();
  const url=(v:string|null|undefined,path:(string|number)[])=>{if(v&&!validCatalogUrl(v))error(path,'public HTTP(S) URL without credentials or internal address required');};
  for(const [i,v]of p.vendors.entries())url(v.officialUrl,['vendors',i,'officialUrl']);
  for(const [i,e]of p.evidence.entries()){url(e.url,['evidence',i,'url']);if(!e.publisher?.trim())error(['evidence',i,'publisher'],'publisher required');}
  for(const [i,v]of p.products.entries()){
    const at=['products',i];url(v.draft.officialUrl,[...at,'draft','officialUrl']);
    const verify=(f:{evidenceKey?:string|null;verifiedAt?:string|null},definite:boolean,path:(string|number)[])=>{
      if(f.evidenceKey&&!evidence.has(f.evidenceKey))error([...path,'evidenceKey'],'Evidence reference is not in this pack');
      if(definite&&(!f.evidenceKey||!f.verifiedAt))error(path,'definite fact requires Evidence key and verifiedAt');
    };
    verify(v.draft,(v.draft.lifecycleStatus??'unknown')!=='unknown',[...at,'draft']);
    for(const [j,f]of v.markets.entries())verify(f,f.availabilityStatus!=='unknown',[...at,'markets',j]);
    for(const [j,f]of v.languages.entries())verify(f,[f.inputSupport,f.outputSupport,f.uiSupport].some(x=>x!=='unknown'),[...at,'languages',j]);
    for(const [j,f]of v.platforms.entries())verify(f,f.status!=='unknown',[...at,'platforms',j]);
    for(const [j,f]of v.capabilities.entries())verify(f,f.supportLevel!=='unknown',[...at,'capabilities',j]);
    for(const [j,f]of v.plans.entries()){
      verify(f,[f.audience??'unknown',f.billingModel??'unknown',f.activeStatus??'unknown'].some(x=>x!=='unknown'),[...at,'plans',j]);
      unique(f.prices.map(r=>r.key),[...at,'plans',j,'prices']);
      for(const [k,r]of f.prices.entries()){verify(r,r.priceType!=='unknown',[...at,'plans',j,'prices',k]);if(['fixed','from'].includes(r.priceType)&&r.billingPeriod==='none')error([...at,'plans',j,'prices',k],'fixed/from requires billing period');}
    }
    for(const [j,m]of v.monitors.entries())url(m.url,[...at,'monitors',j,'url']);
    unique(v.markets.map(f=>f.marketCode),[...at,'markets']);unique(v.languages.map(f=>f.languageCode),[...at,'languages']);unique(v.platforms.map(f=>f.platformKey),[...at,'platforms']);unique(v.capabilities.map(f=>f.capabilityKey),[...at,'capabilities']);unique(v.plans.map(f=>f.planKey),[...at,'plans']);unique(v.monitors.map(f=>f.key),[...at,'monitors']);
    unique(v.plans.flatMap(plan=>plan.prices.map(price=>price.basePriceId).filter((id):id is string=>!!id)),[...at,'basePriceIds']);
    unique(v.aliases.map(a=>normalizeAlias(a.alias)),[...at,'aliases']);
    for(const a of v.aliases){const normalized=normalizeAlias(a.alias),owner=aliases.get(normalized);if(owner&&owner!==v.slug)error([...at,'aliases'],'alias collides with another pack Product');aliases.set(normalized,v.slug);}
  }
});
export type CatalogPack=z.infer<typeof CatalogPackSchema>;
