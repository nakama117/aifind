import { createHash } from 'node:crypto';
import { CandidateSchema, parseAmountMinor } from '../admin/contracts.ts';
import { normalizeProposal, validateTarget } from '../changes/targets.ts';
import type { ProductSnapshot } from '../contracts.ts';
import { DetectorChangeSchema } from './contracts.ts';
import type { DetectorChange } from './contracts.ts';

export function stableJson(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
  if(value && typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  return JSON.stringify(value)??'null';
}
export const sha256=(text:string)=>createHash('sha256').update(text).digest('hex');
export class UnsupportedEvidenceError extends Error {}
const hasToken=(text:string,token:string)=>new RegExp(`(?<![\\p{L}\\p{N}])${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}\\p{N}])`,'iu').test(text);
/** Narrow prose support: one explicit price statement. Other prose remains for human interpretation. */
function validateProsePrice(c:DetectorChange,q:string,base:ProductSnapshot):void {
  const v=c.proposedValue,plan=base.plans.find(p=>p.planKey===c.targetKey)!;
  const unsupported=(message:string):never=>{throw new UnsupportedEvidenceError(message);};
  if(!hasToken(q,plan.name)&&!hasToken(q,c.targetKey))unsupported('plan identity not explicitly evidenced');
  if(v.marketCode==='JP'&&!/\bJP\b|\bJapan\b|日本/i.test(q))unsupported('Japan scope absent');
  if(v.marketCode==='US'&&!/\bUS\b|\bUnited States\b|米国/i.test(q))unsupported('US scope absent');
  if(!v.marketCode||!v.unitLabel||!hasToken(q,String(v.unitLabel)))unsupported('market/unit incomplete');
  if(v.validFrom!==null||v.validTo!==null)unsupported('prose validity requires human interpretation');
  if(v.priceType!=='fixed'&&v.priceType!=='from')unsupported('non-numeric prose price requires human interpretation');
  const amounts=[...q.matchAll(/(?<![\p{L}\p{N}])(?:(from)\s+)?(JPY|USD|EUR|GBP)\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\p{N}.,])/giu)];
  if(amounts.length!==1)unsupported('one unambiguous currency amount token is required');
  const amount=amounts[0];
  if(amount[2].toUpperCase()!==v.currencyCode||parseAmountMinor(amount[3].replaceAll(',',''),v.currencyCode as any)!==v.amountMinor)unsupported('currency or full amount token disagrees');
  const from=!!amount[1];
  if((v.priceType==='from')!==from || (!from && /\bfrom\b|starting|minimum|以上|から|最低/i.test(q)))unsupported('fixed/from price semantics disagree');
  const periods:Record<string,RegExp>={month:/\bper\s+month\b|\/\s*month\b|月額/i,year:/\bper\s+year\b|\/\s*year\b|年額/i};
  if(!periods[String(v.billingPeriod)]?.test(q))unsupported('billing period cannot be reliably interpreted');
  if(/\bnot\b|no\s+longer|only\s+(?:in|for)|excluding|除外|未提供|廃止/i.test(q))unsupported('qualified or negative prose price requires human interpretation');
}
export function validateChange(raw:unknown,text:string,base:ProductSnapshot):DetectorChange {
  const c=DetectorChangeSchema.parse(raw),v=c.proposedValue;
  if(text.slice(c.evidenceLocator.start,c.evidenceLocator.end)!==c.evidenceQuote)throw new Error('quote/locator does not identify observation text');
  for(const key of ['evidenceId','verifiedAt','lifecycleEvidenceId','lifecycleVerifiedAt','id'])if(key in v)throw new Error('proof, verification and row identity are executor-owned');
  const parsed=CandidateSchema.parse({candidateType:c.candidateType,targetKey:c.targetKey,targetRef:c.targetRef??null,
    productId:base.identity.id,baseVersionId:base.version.id,evidenceId:'validated-evidence',sourceType:'manual',reason:'detector validation',
    proposedValue:v});
  validateTarget(base,{...parsed,targetRef:parsed.targetRef??null});
  const q=c.evidenceQuote;
  let structured:Record<string,unknown>|null=null;
  try { const value=JSON.parse(q);if(value && !Array.isArray(value) && typeof value==='object')structured=value; } catch { /* Source text can be ordinary prose. */ }
  if(structured) {
    for(const [k,value] of Object.entries(v))if(stableJson(structured[k])!==stableJson(value))throw new Error(`quoted value disagrees: ${k}`);
    if(c.candidateType==='price' && structured.plan!==c.targetKey)throw new Error('quoted plan disagrees');
  } else {
    if(c.candidateType==='price')validateProsePrice(c,q,base);
    else throw new UnsupportedEvidenceError(`${c.candidateType}: prose does not attest exact controlled values; human interpretation required`);
  }
  if(c.candidateType==='price') {
    for(const key of ['marketCode','currencyCode','billingPeriod','priceType','amountMinor','unitLabel','validFrom','validTo'])if(!(key in v))throw new Error(`price context missing: ${key}`);
    if((v.priceType==='fixed'||v.priceType==='from') && (!v.marketCode||!v.unitLabel))throw new Error('fixed price needs market and unit');
  }
  const normalized=normalizeProposal(parsed);
  return {...c,proposedValue:Object.fromEntries(Object.entries(normalized).filter(([k])=>!['evidenceId','verifiedAt','lifecycleEvidenceId','lifecycleVerifiedAt'].includes(k)))};
}
export function proposalKey(input:{productId:string;baseVersionId:string;contentHash:string;change:Pick<DetectorChange,'candidateType'|'targetKey'|'targetRef'|'proposedValue'>;resolverVersion:string;detectorVersion:string;promptVersion:string}):string {
  const semantic=Object.fromEntries(Object.entries(input.change.proposedValue).filter(([k])=>!['evidenceId','verifiedAt','lifecycleEvidenceId','lifecycleVerifiedAt'].includes(k)));
  return sha256(stableJson({...input,change:{candidateType:input.change.candidateType,targetKey:input.change.targetKey,targetRef:input.change.targetRef??null,proposedValue:semantic}}));
}
