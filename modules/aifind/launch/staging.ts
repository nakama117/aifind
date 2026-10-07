import {sql} from '@aihot/backend/db';
import {assertCatalogWrites,importCatalogPack,inspectCatalogPack,type PackInspection} from '../catalog-pack/import.ts';
import {validateLaunchCorpus,sourceBackedReadinessIssues} from './corpus.ts';
import type {LaunchCorpus} from './contracts.ts';
/** Explicit operator command. Startup, Preview GET and preflight never call this function. */
export async function stageLaunchCorpus(input:unknown,actor:string){
  assertCatalogWrites(process.env);const c=validateLaunchCorpus(input);
  return importCatalogPack(c.pack,actor);
}
/** Separate publication simulation, confined to a safe non-production DB, with existing audited actions. */
export async function rehearseLaunchPublication(input:unknown,actor:string,reason:string){
  assertCatalogWrites(process.env);
  if(!reason.includes('simulation'))throw Error('explicit simulation reason required; this is not Owner factual approval');
  return publishStaged(validateLaunchCorpus(input),actor,reason);
}
/** Explicit source-backed publication, separate from the historical simulation and production. */
export async function publishLaunchCandidate(input:unknown,actor:string,reason:string){
  assertCatalogWrites(process.env);const c=validateLaunchCorpus(input),issues=sourceBackedReadinessIssues(c);
  if(issues.length)throw Error('source-backed launch validation failed: '+issues.join('; '));
  const staged=await inspectCatalogPack(c.pack);
  if(!staged.valid||staged.products.some(p=>p.state!=='same'||!p.draftVersionId||!p.draftRevision))throw Error('Unchanged staged Drafts required; changed or missing human work is preserved');
  return publishStaged(c,actor,reason,staged.products);
}
async function publishStaged(c:LaunchCorpus,actor:string,reason:string,expected?:PackInspection['products']){
  const {readAdminProduct}=await import('../admin/read.ts'),{publishAdminDraft}=await import('../admin/products.ts');
  const {setProductPublicVisibility}=await import('../catalog/public-settings.ts');
  const refs=new Map<string,{productId:string;versionId:string}>();
  for(const p of c.pack.products){
    const [row]=await sql`SELECT id FROM af_products WHERE slug=${p.slug}`;if(!row)throw Error('Product not staged: '+p.slug);
    let d=await readAdminProduct(row.id);
    const staged=expected?.find(item=>item.slug===p.slug&&item.productId===row.id);
    if(expected&&(!staged||!d.draft||d.draft.version.id!==staged.draftVersionId||d.draftRevision!==staged.draftRevision))throw Error('Staged Draft changed during publication: '+p.slug);
    if(d.draft)await publishAdminDraft(row.id,d.draft.version.id,{expectedRevision:staged?.draftRevision??d.draftRevision!,reason},actor);
    d=await readAdminProduct(row.id);if(!d.published)throw Error('Published Product missing');
    await setProductPublicVisibility(row.id,{visibility:'listed',expectedRevision:d.identityRevision,reason},actor);
    refs.set(p.slug,{productId:row.id,versionId:d.published.version.id});
  }
  const {createEditorial,publishEditorial}=await import('../editorial/documents.ts');
  const documents=[];
  for(const source of c.editorial){
    const content=structuredClone(source),rows=content.type==='comparison'?content.comparison.products:content.type==='category'?content.category.products:content.guide.products;
    for(const r of rows){const mapped=refs.get(r.productId)!;r.productId=mapped.productId;r.referencePublishedVersionId=mapped.versionId;}
    const d=await createEditorial({content,reason},actor);await publishEditorial(d.id,{expectedRevision:d.revision,reason},actor);documents.push({id:d.id,slug:content.slug,type:content.type});
  }
  return{products:[...refs].map(([slug,r])=>({slug,...r})),documents,ownerApproved:0,action:expected?'source-backed non-production launch publication':'documented non-production operator simulation'};
}
