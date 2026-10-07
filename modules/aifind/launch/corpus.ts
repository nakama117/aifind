import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LaunchCorpusSchema,type LaunchCorpus} from './contracts.ts';
import {validCatalogUrl} from '../catalog-pack/contracts.ts';
import {productRefs} from '../editorial/contracts.ts';
import type {ProductSnapshot} from '../contracts.ts';
export function assertNoSynthetic(value:unknown):void{
  const text=JSON.stringify(value).normalize('NFKC');
  if(/\[(?:preview|synthetic|test)\]|(?:synthetic|aifind-preview)-/i.test(text))throw Error('synthetic/preview marker in launch content');
}
export function validateLaunchCorpus(input:unknown):LaunchCorpus{
  assertNoSynthetic(input);
  if(JSON.stringify(input).includes('owner_approved'))throw Error('Owner approval cannot be self-assigned by the staging importer');
  const c=LaunchCorpusSchema.parse(input);
  if(c.pack.dataKind!=='source_material'||c.pack.products.length<12||c.pack.products.length>20)throw Error('launch requires 12–20 source_material Products');
  const slugs=new Set(c.pack.products.map(p=>p.slug));
  if(c.dossiers.length!==slugs.size||new Set(c.dossiers.map(d=>d.productSlug)).size!==slugs.size)throw Error('one source dossier per Product required');
  for(const d of c.dossiers){
    if(!slugs.has(d.productSlug)||!['product','pricing','docs'].every(role=>d.sources.some(s=>s.role===role)))throw Error('missing official source dossier');
    if(d.sources.some(s=>!validCatalogUrl(s.url)))throw Error('public official URLs required');
    const p=c.pack.products.find(p=>p.slug===d.productSlug)!;
    if(!p.vendorKey||!p.draft.summaryJa||!p.draft.officialUrl||!p.markets.some(m=>m.marketCode==='JP')||!p.languages.some(l=>l.languageCode==='ja')||!p.platforms.length||!p.plans.some(p=>p.prices.length))throw Error('minimum Product readiness fields missing');
    if(!d.sources.some(s=>s.url===p.draft.officialUrl))throw Error('official URL is outside Product dossier');
    for(const s of d.sources)if(s.quote&&createHash('sha256').update(s.quote).digest('hex')!==s.excerptHash)throw Error('source excerpt hash mismatch');
  }
  for(const type of ['comparison','category','guide'])if(c.editorial.filter(e=>e.type===type).length<2)throw Error('two candidates per editorial type required');
  for(const e of c.editorial){
    if(productRefs(e).some(p=>!slugs.has(p.productId)||p.referencePublishedVersionId!==p.productId))throw Error('Editorial reference outside launch corpus');
    if(e.type==='comparison'&&(e.comparison.mode!=='official_sources'||e.comparison.products.some(p=>p.testRecord)))throw Error('official_sources only; no hands_on Test Record');
    if(e.type==='guide'&&(e.guide.mode!=='official_sources'||e.guide.products.some(p=>p.testRecord)))throw Error('official_sources only; no hands_on Test Record');
  }
  return c;
}
export async function readLaunchCorpus():Promise<LaunchCorpus>{return validateLaunchCorpus(JSON.parse(await readFile(new URL('../../../site/launch/2026-10-07-corpus.json',import.meta.url),'utf8')));}

type SourceFact={field:string;values:Record<string,string|number|null>;url?:string;sourceKind?:string};
/** Stable field/value projection shared by source material and Domain snapshots; database IDs are not facts. */
function sourceFacts(p:LaunchCorpus['pack']['products'][number]|ProductSnapshot,evidence:Array<{id?:string;key?:string;url:string;sourceKind:string}>):SourceFact[]{
  const fields:SourceFact[]=[],published='version' in p;
  const proof=(f:{evidenceId?:string|null;evidenceKey?:string|null})=>published?f.evidenceId:f.evidenceKey;
  const add=(field:string,asserted:boolean,values:SourceFact['values'],key?:string|null)=>{if(asserted){const e=evidence.find(e=>(e.id??e.key)===key);
    fields.push({field,values:Object.fromEntries(Object.entries(values).filter(([,value])=>value!=='unknown')),url:e?.url,sourceKind:e?.sourceKind});}};
  if(published)add('lifecycle',p.version.lifecycleStatus!=='unknown',{lifecycleStatus:p.version.lifecycleStatus},p.version.lifecycleEvidenceId);
  else add('lifecycle',(p.draft.lifecycleStatus??'unknown')!=='unknown',{lifecycleStatus:p.draft.lifecycleStatus??'unknown'},p.draft.evidenceKey);
  p.markets.forEach(f=>add('market:'+f.marketCode,f.availabilityStatus!=='unknown',{availabilityStatus:f.availabilityStatus},proof(f)));
  p.languages.forEach(f=>add('language:'+f.languageCode,[f.inputSupport,f.outputSupport,f.uiSupport].some(s=>s!=='unknown'),
    {inputSupport:f.inputSupport,outputSupport:f.outputSupport,uiSupport:f.uiSupport},proof(f)));
  p.platforms.forEach(f=>add('platform:'+f.platformKey,f.status!=='unknown',{status:f.status},proof(f)));
  p.capabilities.forEach(f=>add('capability:'+f.capabilityKey,f.supportLevel!=='unknown',{supportLevel:f.supportLevel},proof(f)));
  for(const plan of p.plans){const values={name:plan.name,audience:plan.audience??'unknown',billingModel:plan.billingModel??'unknown',activeStatus:plan.activeStatus??'unknown'};
    add('plan:'+plan.planKey,[values.audience,values.billingModel,values.activeStatus].some(s=>s!=='unknown'),values,proof(plan));
    for(const price of plan.prices)add('price:'+plan.planKey,price.priceType!=='unknown',
      {priceType:price.priceType,billingPeriod:price.billingPeriod,amountMinor:price.amountMinor??null,currencyCode:price.currencyCode??null,marketCode:price.marketCode??null,
        unitLabel:price.unitLabel??null,validFrom:price.validFrom??null,validTo:price.validTo??null},proof(price));
  }
  return fields;
}
function sourceIssues(slug:string,fields:SourceFact[],d:LaunchCorpus['dossiers'][number]):string[]{
  const issues:string[]=[];
  for(const fact of fields){
    const source=d.sources.find(s=>s.url===fact.url&&s.sourceKind===fact.sourceKind);
    if(!source||!source.sourceKind.startsWith('official_'))issues.push(`${slug} ${fact.field}: official Evidence is outside this Product dossier`);
    else if(source.access!=='accessible')issues.push(`${slug} ${fact.field}: directly supporting source is not publicly accessible`);
    else if(!source.reviewedFacts.some(reviewed=>reviewed.field===fact.field&&Object.entries(fact.values).every(([key,value])=>reviewed.values[key]===value)
      &&(reviewed.supportingSources??[]).every(url=>d.sources.some(s=>s.url===url&&s.access==='accessible'&&s.sourceKind.startsWith('official_')))))
      issues.push(`${slug} ${fact.field}: field/value is not supported by this source's reviewed facts`);
    if(d.unresolvedContradictions.includes(fact.field))issues.push(`${slug} ${fact.field}: unresolved source contradiction`);
  }
  return issues;
}
/** Reviewed source field/value binding, accessibility and explicit contradictions; no model or HTTP request. */
export function sourceBackedProductIssues(p:ProductSnapshot,d:LaunchCorpus['dossiers'][number]):string[]{
  return sourceIssues(p.identity.slug,sourceFacts(p,p.evidence),d);
}
export function sourceBackedReadinessIssues(input:unknown):string[]{
  let c:LaunchCorpus;try{c=validateLaunchCorpus(input);}catch(error){return[error instanceof Error?error.message:String(error)];}
  const issues:string[]=[];
  if(c.pack.products.length!==12)issues.push('Launch Candidate requires exactly 12 real Products');
  const identities=['chatgpt','claude','gemini','gemini-notebook','perplexity','cursor','github-copilot','adobe-firefly','runway','elevenlabs','notion-ai','dify'];
  if(identities.some(slug=>!c.pack.products.some(p=>p.slug===slug)))issues.push('Authorized launch Product identity set must be preserved');
  for(const p of c.pack.products){
    const d=c.dossiers.find(d=>d.productSlug===p.slug)!;
    issues.push(...sourceIssues(p.slug,sourceFacts(p,c.pack.evidence),d));
    if(!d.sources.some(s=>s.access==='accessible'&&s.sourceKind.startsWith('official_')))issues.push(p.slug+': no accessible official identity source');
  }
  const text=JSON.stringify([c.pack.products.map(p=>p.draft.summaryJa),c.editorial]).replace(/AIFIND(?:による)?実測では(?:ありません|ない)|AIFIND実測は行っていません/g,'');
  if(/AIFIND(?:による)?実測|\bNo\.?\s*1\b|最強|(?:ユーザー数|利用者数|rating|ランキングスコア)\s*[:：]?\s*[0-9０-９]/i.test(text))issues.push('unsupported ranking, usage-count or hands-on claim in generated launch text');
  return issues;
}
