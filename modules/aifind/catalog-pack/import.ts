import {createHash} from 'node:crypto';
import {sql,type Tx} from '@aihot/backend/db';
import {audit,Conflict} from '@aihot/backend/audit';
import {InvalidInput} from '../admin/errors.ts';
import {CatalogPackSchema,type CatalogPack} from './contracts.ts';
import {createVendor,createProduct,addProductAlias} from '../catalog/identity.ts';
import {normalizeAlias} from '../catalog/normalize.ts';
import {createEvidence} from '../catalog/evidence.ts';
import {createProductDraft,clonePublishedProduct,updateProductDraft} from '../catalog/versions.ts';
import {setProductMarket,setProductLanguageSupport,setProductPlatform,setProductCapability} from '../catalog/facts.ts';
import {saveProductPlan,saveProductPrice} from '../catalog/pricing.ts';
import {readProducts,type VersionRow} from '../catalog/read.ts';
import {validatePublishedFacts} from '../catalog/verification.ts';
import {createMonitor} from '../detector/monitors.ts';

export function assertCatalogWrites(env:NodeJS.ProcessEnv):void {
  const u=new URL(env.DATABASE_URL??'postgres://unset/unset');
  if(env.NODE_ENV==='production'||env.AIHOT_ENVIRONMENT==='production'||u.search||!['postgres:','postgresql:'].includes(u.protocol)
    ||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||!/^\/[a-zA-Z0-9_]+_(test|ci|preview)$/.test(u.pathname))throw Error('Catalog import requires a non-production loopback *_test/_ci/_preview database without override parameters');
}
export function stablePackJson(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(stablePackJson).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+stablePackJson(v)).join(',')+'}';
  return JSON.stringify(value);
}
const hash=(v:unknown)=>createHash('sha256').update(stablePackJson(v)).digest('hex');
type ProductResult={slug:string;state:'new'|'same'|'conflict';reason:string|null;productId:string|null;draftVersionId:string|null;draftRevision:number|null};
export interface PackInspection {valid:boolean;packId:string|null;revision:number|null;dataKind:string|null;
  vendors:Array<{slug:string;state:'new'|'same'|'conflict'}>;products:ProductResult[];evidenceCount:number;monitorCount:number;errors:string[]}

async function inspect(db:Tx,p:CatalogPack):Promise<PackInspection> {
  const result:PackInspection={valid:true,packId:p.packId,revision:p.revision,dataKind:p.dataKind,vendors:[],products:[],evidenceCount:p.evidence.length,monitorCount:p.products.reduce((n,v)=>n+v.monitors.length,0),errors:[]};
  const [receipt]=await db`SELECT * FROM af_catalog_imports WHERE pack_id=${p.packId} AND revision=${p.revision}`;
  const saved=(receipt?.products??[]) as ProductResult[];
  if(receipt&&receipt.content_hash!==hash(p))result.errors.push('Pack identity/revision already exists with a different payload');
  for(const v of p.vendors){const [row]=await db`SELECT * FROM af_vendors WHERE slug=${v.slug}`;
    const same=!row||row.name===v.name&&row.legal_name===(v.legalName??null)&&row.official_url===(v.officialUrl??null)&&row.country_code===(v.countryCode??null)&&row.status===(v.status??'unknown');
    result.vendors.push({slug:v.slug,state:!row?'new':same?'same':'conflict'});if(!same)result.errors.push(`Vendor conflict: ${v.slug}`);
  }
  for(const v of p.products){
    const [row]=await db`SELECT * FROM af_products WHERE slug=${v.slug}`;
    const item:ProductResult={slug:v.slug,state:'new',reason:null,productId:row?.id??null,draftVersionId:null,draftRevision:null};
    const conflict=(reason:string)=>{item.state='conflict';item.reason=reason;};
    const [vendor]=v.vendorKey?await db`SELECT id FROM af_vendors WHERE slug=${v.vendorKey}`:[];
    if(v.vendorKey&&!vendor&&!p.vendors.some(x=>x.slug===v.vendorKey))conflict('Vendor key is not registered or in the pack');
    if(row){
      const [draft]=await db`SELECT * FROM af_product_versions WHERE product_id=${row.id} AND status='draft'`;
      const [published]=await db`SELECT * FROM af_product_versions WHERE product_id=${row.id} AND status='published'`;
      const previous=saved.find(x=>x.slug===v.slug);
      if(previous){
        const [version]=await db`SELECT * FROM af_product_versions WHERE id=${previous.draftVersionId!}`;
        if(receipt.content_hash!==hash(p)||!version||version.status!=='draft'||version.revision!==previous.draftRevision
          ||row.canonical_name!==v.canonicalName||row.vendor_id!==(vendor?.id??null))conflict('Imported Draft/identity was changed; human work is preserved');
        else{Object.assign(item,previous,{state:'same',reason:null});}
      }else if(draft)conflict('An existing Draft cannot be overwritten by a pack');
      else if(!v.base||v.base.expectedIdentityRevision!==row.identity_revision||v.base.publishedVersionId!==published?.id)conflict('Explicit current Published base and identity revision required');
      else if(row.canonical_name!==v.canonicalName||row.vendor_id!==(vendor?.id??null))conflict('Pack cannot edit an existing Product identity');
      else item.reason='Create a separate Draft from the explicitly confirmed Published base';
    }else if(v.base)conflict('New Product cannot claim an existing Published base');
    if(!row){const [claim]=await db`SELECT product_id FROM af_product_slug_redirects WHERE old_slug=${v.slug}`;if(claim)conflict('Slug is permanently reserved by another Product historical URL');}
    for(const alias of v.aliases){const owners=await db`SELECT product_id FROM af_product_aliases WHERE normalized_alias=${normalizeAlias(alias.alias)}`;
      if(owners.some(a=>a.product_id!==row?.id))conflict(`Alias already belongs to another Product: ${alias.alias}`);
      if(row&&!owners.some(a=>a.product_id===row.id))conflict('Existing Product aliases are live identity; a Draft import cannot add new aliases');
    }
    for(const plan of v.plans)for(const price of plan.prices){
      if(price.basePriceId){const [target]=await db`SELECT r.id FROM af_product_prices r JOIN af_product_plans pl ON pl.id=r.plan_id
        WHERE r.id=${price.basePriceId} AND pl.product_version_id=${v.base?.publishedVersionId??''} AND pl.plan_key=${plan.planKey}`;
        if(!target)conflict('basePriceId must belong to the explicitly confirmed Published plan');
      }else if(v.base){const [existing]=await db`SELECT r.id FROM af_product_prices r JOIN af_product_plans pl ON pl.id=r.plan_id
        WHERE pl.product_version_id=${v.base.publishedVersionId} AND pl.plan_key=${plan.planKey} LIMIT 1`;
        if(existing)conflict('Existing plan prices require explicit basePriceId; pack cannot duplicate cloned components');
      }
    }
    if(result.errors.some(e=>e.startsWith('Pack identity')))conflict('Pack identity/revision payload conflict');
    result.products.push(item);
  }
  result.valid=result.errors.length===0&&!result.products.some(r=>r.state==='conflict');
  return result;
}
export async function inspectCatalogPack(input:unknown):Promise<PackInspection> {
  assertCatalogWrites(process.env);
  const parsed=CatalogPackSchema.safeParse(input);
  if(!parsed.success)return{valid:false,packId:null,revision:null,dataKind:null,vendors:[],products:[],evidenceCount:0,monitorCount:0,errors:parsed.error.issues.map(i=>i.path.join('.')+': '+i.message)};
  return sql.begin('isolation level repeatable read read only',tx=>inspect(tx,parsed.data));
}
/** Atomic transport into Draft only. There is intentionally no Publish/visibility API in this module. */
export async function importCatalogPack(input:unknown,actor:string):Promise<PackInspection> {
  assertCatalogWrites(process.env);
  const parsed=CatalogPackSchema.safeParse(input);if(!parsed.success)throw new InvalidInput(parsed.error.issues.map(i=>i.path.join('.')+': '+i.message).join('; '));
  const p=parsed.data;
  return sql.begin('isolation level read committed',async tx=>{
    // Packs share Vendor/Alias/Evidence identities; serializing import transactions makes concurrent retries deterministic.
    await tx`SELECT pg_advisory_xact_lock(hashtextextended('aifind.catalog-pack',0))`;
    await tx`SELECT id FROM af_products WHERE slug IN ${tx(p.products.map(v=>v.slug))} ORDER BY id FOR UPDATE`;
    const result=await inspect(tx,p);
    if(!result.valid)throw new Conflict([...result.errors,...result.products.filter(r=>r.state==='conflict').map(r=>r.slug+': '+r.reason)].join('; '));
    if(result.products.every(r=>r.state==='same'))return result;
    const vendors=new Map<string,string>();
    for(const v of p.vendors){const [old]=await tx`SELECT id FROM af_vendors WHERE slug=${v.slug}`;vendors.set(v.slug,old?.id??(await createVendor(v,tx)).id);}
    for(const v of p.products)if(v.vendorKey&&!vendors.has(v.vendorKey)){const [old]=await tx`SELECT id FROM af_vendors WHERE slug=${v.vendorKey}`;vendors.set(v.vendorKey,old.id);}
    const evidence=new Map<string,string>();
    for(const e of p.evidence){const {key,...material}=e,identity=hash(material);const [old]=await tx`SELECT evidence_id FROM af_catalog_evidence WHERE identity_hash=${identity}`;
      let id=old?.evidence_id;if(!id){id=(await createEvidence(material,tx)).id;await tx`INSERT INTO af_catalog_evidence(identity_hash,evidence_id)VALUES(${identity},${id})`;}evidence.set(key,id);
    }
    function fact<T extends {evidenceKey?:string|null;evidenceId?:unknown}>(f:T){const {evidenceKey,evidenceId,...fields}=f;return{...fields,evidenceId:evidenceKey?evidence.get(evidenceKey)!:null};}
    for(const [i,v]of p.products.entries()){
      const item=result.products[i];
      const productId=item.productId??(await createProduct({slug:v.slug,canonicalName:v.canonicalName,vendorId:v.vendorKey?vendors.get(v.vendorKey):null},tx)).id;
      const {evidenceKey,verifiedAt,...metadata}=v.draft;
      const draftData={...metadata,lifecycleEvidenceId:evidenceKey?evidence.get(evidenceKey)!:null,lifecycleVerifiedAt:verifiedAt??null};
      const draft=v.base?await clonePublishedProduct(productId,actor,tx):await createProductDraft(productId,draftData,actor,tx);
      if(v.base)await updateProductDraft(productId,draft.version.id,draftData,tx);
      for(const alias of v.aliases){const [old]=await tx`SELECT id FROM af_product_aliases WHERE product_id=${productId} AND normalized_alias=${normalizeAlias(alias.alias)}`;if(!old)await addProductAlias(productId,alias,tx);}
      for(const f of v.markets)await setProductMarket(productId,draft.version.id,fact(f),tx);
      for(const f of v.languages)await setProductLanguageSupport(productId,draft.version.id,fact(f),tx);
      for(const f of v.platforms)await setProductPlatform(productId,draft.version.id,fact(f),tx);
      for(const f of v.capabilities)await setProductCapability(productId,draft.version.id,fact(f),tx);
      for(const plan of v.plans){const {prices,...fields}=plan,row=await saveProductPlan(productId,draft.version.id,fact(fields),tx);
        for(const price of prices){const {key,basePriceId,...fields}=price;
          const [cloned]=basePriceId?await tx`SELECT id FROM af_product_prices WHERE plan_id=${row.id} AND base_price_id=${basePriceId}`:[];
          await saveProductPrice(productId,draft.version.id,row.id,{...fact(fields),...(cloned?{id:cloned.id}:{})},tx);}
      }
      for(const m of v.monitors){const {key,...fields}=m;await createMonitor({...fields,productId,enabled:false,allowJina:false,reason:`Catalog pack ${p.packId}/${p.revision}: disabled Monitor`},actor,tx);}
      const [version]=await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE id=${draft.version.id}`;
      const snapshot=(await readProducts(tx,[version]))[0];validatePublishedFacts(snapshot);
      Object.assign(item,{productId,draftVersionId:version.id,draftRevision:version.revision});
      await audit(actor,'aifind.catalog.import','aifind:product:'+productId,`${p.packId}/${p.revision}: Draft only`,null,{packId:p.packId,dataKind:p.dataKind,draftVersionId:version.id},{db:tx});
    }
    await tx`INSERT INTO af_catalog_imports(pack_id,revision,content_hash,data_kind,products,actor)VALUES(${p.packId},${p.revision},${hash(p)},${p.dataKind},${tx.json(result.products)},${actor})`;
    return result;
  });
}
