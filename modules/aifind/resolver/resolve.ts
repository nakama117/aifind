import { normalizeAlias } from '../catalog/normalize.ts';
import { RESOLVER_VERSION } from './contracts.ts';
import type { ResolverInput, ResolverProduct, ResolverResult } from './contracts.ts';

/** A registered relationship is an identity signal, never a host-wide association. */
export function resolveIdentity(input: ResolverInput, products: ResolverProduct[]): ResolverResult {
  const identity=normalizeAlias(input.identity ?? ''), vendor=normalizeAlias(input.vendor ?? '');
  const exact = identity ? products.filter(p=>[p.canonicalName,...p.aliases].some(n=>normalizeAlias(n)===identity)) : [];
  let matches=exact, method: ResolverResult['method']=exact.length?'identity':'none';
  if(exact.length>1 && vendor) { const scoped=exact.filter(p=>normalizeAlias(p.vendorName??'')===vendor); if(scoped.length){matches=scoped;method='vendor_identity';} }
  const text=normalizeAlias(input.text??'');
  const mentions=(name:string)=>{const n=normalizeAlias(name);return !!n&&new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}\\p{N}])`,'u').test(text);};
  const body=products.filter(p=>[p.canonicalName,...p.aliases].some(mentions));
  let hardConflict=products.filter(p=>mentions(p.canonicalName)).length>1;
  if(!identity){matches=body;if(matches.length)method='text';}
  else if(body.some(p=>!matches.some(m=>m.id===p.id))){matches=[...matches,...body];hardConflict=true;}
  const related=products.filter(p=>p.id===input.registeredProductId || p.officialUrls.some(u=>new URL(u).href===new URL(input.url).href));
  if(related.length>1)hardConflict=true;
  if(related.length) {
    if(matches.length && related.some(p=>!matches.some(m=>m.id===p.id))) {matches=[...matches,...related];hardConflict=true;}
    else if(!identity && !matches.length) {matches=related;method='registered_source';}
    else if(identity && !matches.length) { // Explicit unrecognized identity contradicts the configured source.
      return {status:'unresolved',productId:null,candidateIds:related.map(p=>p.id).sort(),method:'none',version:RESOLVER_VERSION,reason:'explicit identity does not match the registered product',receiptId:null,hardConflict:true};
    }
  }
  const ids=[...new Set(matches.map(p=>p.id))].sort();
  const status=ids.length>1?'ambiguous':identity&&!exact.length?'unresolved':ids.length===1?'resolved':'unresolved';
  return {status,productId:status==='resolved'?ids[0]:null,candidateIds:ids,
    method,version:RESOLVER_VERSION,reason:hardConflict?'conflicting explicit product identities':ids.length===1?'unique product identity':ids.length?'multiple product identities':'no product identity; vendor/host is insufficient',receiptId:null,...(hardConflict?{hardConflict:true}:{})};
}
