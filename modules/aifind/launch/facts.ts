import {createHash} from 'node:crypto';
import {CAPABILITY_KEYS,PLATFORM_KEYS,type ProductSnapshot} from '../contracts.ts';
import type {LaunchCorpus} from './contracts.ts';
type Product=LaunchCorpus['pack']['products'][number]|ProductSnapshot;
type Dossier=LaunchCorpus['dossiers'][number];
/** Only published commercial facts participate; DB IDs and transport keys are not prices. */
export function planFactFingerprint(p:Product):string {
 const plans=p.plans.map(p=>({planKey:p.planKey,name:p.name,audience:p.audience??'unknown',billingModel:p.billingModel??'unknown',activeStatus:p.activeStatus??'unknown',
   prices:p.prices.map(r=>({priceType:r.priceType,billingPeriod:r.billingPeriod,amountMinor:r.amountMinor??null,currencyCode:r.currencyCode??null,
     marketCode:r.marketCode??null,unitLabel:r.unitLabel??null,validFrom:r.validFrom??null,validTo:r.validTo??null})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))})).sort((a,b)=>a.planKey.localeCompare(b.planKey));
 return createHash('sha256').update(JSON.stringify(plans)).digest('hex');
}
export function reviewedFreePlanState(p:Product,d?:Dossier):'free'|'trial'|'paid'|'custom'|'unknown' {
 const r=d?.factReview;if(!r||d!.productSlug!==('identity' in p?p.identity.slug:p.slug)||r.freePlanFingerprint!==planFactFingerprint(p))return 'unknown';
 if('version' in p&&(!p.lastVerifiedAt||p.lastVerifiedAt!==d!.lastVerified||r.checkedAt!==d!.lastVerified))return 'unknown';
 const source=d!.sources.find(s=>s.url===r.freePlanSourceUrl&&s.access==='accessible'&&s.sourceKind.startsWith('official_'));
 if(!source?.reviewedFacts.some(f=>f.field==='free-plan-state'&&f.values.state===r.freePlanState))return 'unknown';
 if('evidence' in p&&!p.evidence.some(e=>e.url===source.url&&e.sourceKind===source.sourceKind))return 'unknown';
 return r.freePlanState;
}
/** Count fixed controlled fields, not nullable amounts/currencies on free/custom contracts. */
export function unknownFactFields(p:Product,freeState:string):string[] {
 const fields:string[]=[],unknown=(key:string,v:string|undefined)=>{if(!v||v==='unknown')fields.push(key);};
 unknown('lifecycle','version' in p?p.version.lifecycleStatus:p.draft.lifecycleStatus);
 unknown('market:JP',p.markets.find(m=>m.marketCode==='JP')?.availabilityStatus);
 const ja=p.languages.find(l=>l.languageCode==='ja');for(const key of ['inputSupport','outputSupport','uiSupport'] as const)unknown('language:ja:'+key,ja?.[key]);
 for(const key of PLATFORM_KEYS)unknown('platform:'+key,p.platforms.find(f=>f.platformKey===key)?.status);
 for(const key of CAPABILITY_KEYS)unknown('capability:'+key,p.capabilities.find(f=>f.capabilityKey===key)?.supportLevel);
 unknown('free-plan-state',freeState);
 for(const plan of p.plans){for(const key of ['audience','billingModel','activeStatus'] as const)unknown('plan:'+plan.planKey+':'+key,plan[key]);
   for(const [i,price] of plan.prices.entries())unknown('price:'+plan.planKey+':'+i+':priceType',price.priceType);}
 return fields;
}
export function productFactCompletenessIssues(p:Product,d:Dossier):string[]{
 const slug='identity' in p?p.identity.slug:p.slug,r=d.factReview,issues:string[]=[];
 if(!r)return [slug+': fact review missing'];
 if(reviewedFreePlanState(p,d)!==r.freePlanState||r.freePlanFingerprint!==planFactFingerprint(p))issues.push(slug+': free-plan review does not match current facts');
 const remaining=unknownFactFields(p,r.freePlanState);
 if(new Set(r.unknown.map(u=>u.field)).size!==r.unknown.length)issues.push(slug+': duplicate unknown audit');
 if([...remaining].sort().join('|')!==[...d.unknownFields].sort().join('|'))issues.push(slug+': unknown field inventory is not exact');
 if([...remaining].sort().join('|')!==r.unknown.map(u=>u.field).sort().join('|'))issues.push(slug+': every remaining unknown needs an exact audit');
 for(const u of r.unknown){
   if(u.checkedSources.length<2||u.checkedSources.some(url=>!d.sources.some(s=>s.url===url&&s.access==='accessible'&&s.sourceKind.startsWith('official_'))))issues.push(slug+' '+u.field+': checked sources must be accessible official sources in this dossier');
   if(u.checkedAt!==r.checkedAt||new Date(u.checkedAt)>new Date(d.lastVerified))issues.push(slug+' '+u.field+': invalid audit time');
   if(u.reasonStillUnknown.trim().length<30||/not researched|not in existing pack|not enough time|left conservative/i.test(u.reasonStillUnknown))issues.push(slug+' '+u.field+': insufficient research reason');
 }
 return issues;
}
export function factCompletenessIssues(c:LaunchCorpus):string[]{return c.pack.products.flatMap(p=>{const d=c.dossiers.find(d=>d.productSlug===p.slug);return d?productFactCompletenessIssues(p,d):[p.slug+': dossier missing'];});}
