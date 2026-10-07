import {randomUUID} from 'node:crypto';
import {sql} from '@aihot/backend/db';
import {audit} from '@aihot/backend/audit';
import {completeReceipt,BudgetExceededError,ReceiptUnknownError} from '@aihot/backend/providers/receipts';
import {CandidateSchema} from '../admin/contracts.ts';
import type {CandidateRow} from '../changes/candidates.ts';
import {lockCandidateProduct,candidateDto} from '../changes/candidates.ts';
import {normalizeProposal,targetValue} from '../changes/targets.ts';
import {createEvidence} from '../catalog/evidence.ts';
import {readProducts} from '../catalog/read.ts';
import type {VersionRow} from '../catalog/read.ts';
import type {ProductSnapshot} from '../contracts.ts';
import {resolveIdentity} from '../resolver/resolve.ts';
import type {ResolverProduct} from '../resolver/contracts.ts';
import {DetectorOutputSchema,DETECTOR_VERSION,DETECTOR_PROMPT_VERSION} from './contracts.ts';
import type {Observation} from './contracts.ts';
import {readObservation,finishObservation} from './observations.ts';
import {validateChange,proposalKey,stableJson,UnsupportedEvidenceError} from './validate.ts';
import {modelResolve,modelDetect} from './model.ts';
import {semanticKey,linkCandidateEvidence} from '../changes/semantics.ts';
import {observationExecution} from './execution.ts';

export type DetectorAdapter=(observation:Observation,base:ProductSnapshot)=>Promise<{output:unknown;receiptId:number|null}|null>;
export async function resolverDirectory():Promise<ResolverProduct[]> {
  const rows=await sql`SELECT p.id,p.canonical_name,v.name AS vendor_name,
    (SELECT official_url FROM af_product_versions pv WHERE pv.product_id=p.id AND pv.status='published') AS official_url,
    coalesce((SELECT jsonb_agg(a.alias ORDER BY a.id) FROM af_product_aliases a WHERE a.product_id=p.id),'[]') AS aliases
    FROM af_products p LEFT JOIN af_vendors v ON v.id=p.vendor_id ORDER BY p.id LIMIT 1000`;
  return rows.map(r=>({id:r.id,canonicalName:r.canonical_name,vendorName:r.vendor_name,officialUrls:r.official_url?[r.official_url]:[],aliases:r.aliases}));
}
/** Worker-only executor: writes evidence and candidates, never Draft or Published facts. */
export async function processObservation(id:string,options:{adapter?:DetectorAdapter}={}):Promise<Observation> {
  return observationExecution(id,()=>processOwnedObservation(id,options));
}
async function processOwnedObservation(id:string,options:{adapter?:DetectorAdapter}):Promise<Observation> {
  let o=await readObservation(id);
  if(o.prunedAt)return o; // Retained audit context is not new detector input.
  if(['unchanged','fetch_failed','stale'].includes(o.state))return o;
  if(['detected','no_changes'].includes(o.state))return o;
  const products=await resolverDirectory();
  let resolution=resolveIdentity({url:o.url,identity:o.identityHint,vendor:o.vendorHint,text:o.text,registeredProductId:o.productId},products);
  try { resolution=await modelResolve(o,products,resolution); }
  catch(error) { return fail(o,error,null,resolution); }
  const receipts=resolution.receiptId===null?[]:[resolution.receiptId];
  if(resolution.status!=='resolved')return sql.begin('isolation level read committed',tx=>finishObservation(tx,o,{state:resolution.status,resolution,reason:resolution.reason,receiptIds:receipts.map(String)}));
  const base=await sql.begin('isolation level repeatable read read only',async tx=>{
    const [v]=await tx<VersionRow[]>`SELECT * FROM af_product_versions WHERE product_id=${resolution.productId!} AND status='published'`;
    return v?(await readProducts(tx,[v]))[0]:null;
  });
  if(!base)return sql.begin('isolation level read committed',tx=>finishObservation(tx,o,{state:'unresolved',resolution,reason:'resolved product has no Published base',receiptIds:receipts.map(String)}));
  o={...o,resolution,baseVersionId:base.version.id};
  let response:Awaited<ReturnType<DetectorAdapter>>;
  try { response=await (options.adapter??modelDetect)(o,base); }
  catch(error) { return fail(o,error,base.version.id,resolution); }
  if(!response)return sql.begin('isolation level read committed',tx=>finishObservation(tx,o,{state:'model_disabled',resolution,baseVersionId:base.version.id,reason:'MODEL_CALLS_ENABLED=false; no provider request',receiptIds:receipts.map(String)}));
  if(response.receiptId!==null)receipts.push(response.receiptId);
  let output:ReturnType<typeof DetectorOutputSchema.parse>,changes:ReturnType<typeof validateChange>[];
  try {output=DetectorOutputSchema.parse(response.output);changes=output.changes.map(c=>validateChange(c,o.text,base));}
  catch(error) {return sql.begin('isolation level read committed',async tx=>{
    const unsupported=error instanceof UnsupportedEvidenceError;
    const result=await finishObservation(tx,o,{state:unsupported?'no_changes':'invalid',resolution,baseVersionId:base.version.id,reason:String(error),
      unsupported:unsupported?[error.message.slice(0,500)]:[],receiptIds:receipts.map(String)});
    for(const receipt of receipts)await completeReceipt(tx,receipt);return result;
  });}
  return sql.begin('isolation level read committed',async tx=>{
    await lockCandidateProduct(tx,base.identity.id);
    const [locked]=await tx`SELECT * FROM af_source_observations WHERE id=${id} FOR UPDATE`;
    if(locked.pruned_at || ['detected','no_changes','stale','unchanged','fetch_failed'].includes(locked.state)){
      for(const receipt of receipts)await completeReceipt(tx,receipt);
      return readObservation(id,tx);
    }
    const [current]=await tx`SELECT id FROM af_product_versions WHERE product_id=${base.identity.id} AND status='published'`;
    const [monitor]=await tx`SELECT revision FROM af_source_monitors WHERE id=${o.monitorId}`;
    if(current?.id!==base.version.id || monitor.revision!==o.monitorRevision) {
      const result=await finishObservation(tx,o,{state:'stale',resolution,baseVersionId:base.version.id,reason:'Published or monitor revision changed during detection',receiptIds:receipts.map(String)});
      for(const receipt of receipts)await completeReceipt(tx,receipt);return result;
    }
    const ids:string[]=[];
    for(const change of changes) {
      const key=proposalKey({productId:base.identity.id,baseVersionId:base.version.id,contentHash:o.contentHash!,change,
        resolverVersion:resolution.version,detectorVersion:DETECTOR_VERSION,promptVersion:DETECTOR_PROMPT_VERSION});
      const [existing]=await tx`SELECT id FROM af_product_change_candidates WHERE proposal_key=${key}`;
      if(existing){ids.push(existing.id);continue;}
      const previous=await targetValue(tx,base,{...change,targetRef:change.targetRef??null});
      const previousSemantic=previous?Object.fromEntries(Object.entries(previous).filter(([k])=>!['evidenceId','verifiedAt','lifecycleEvidenceId','lifecycleVerifiedAt'].includes(k))):null;
      if(stableJson(previousSemantic)===stableJson(change.proposedValue))continue;
      const evidence=await createEvidence({url:o.url,publisher:o.publisher,sourceKind:o.sourceKind,retrievedAt:o.retrievedAt,publishedAt:o.publishedAt,
        contentHash:o.contentHash,evidenceNote:'自動検出の根拠。取得日時は人による確認日時ではありません。'},tx,
        {observationId:o.id,quote:change.evidenceQuote,
          start:Array.from(o.text.slice(0,change.evidenceLocator.start)).length,
          end:Array.from(o.text.slice(0,change.evidenceLocator.end)).length});
      const c=CandidateSchema.parse({candidateType:change.candidateType,targetKey:change.targetKey,targetRef:change.targetRef??null,proposedValue:change.proposedValue,
        productId:base.identity.id,baseVersionId:base.version.id,evidenceId:evidence.id,sourceType:'manual',reason:'validated detector proposal'});
      const normalized=normalizeProposal(c),sem=semanticKey({...c,targetRef:c.targetRef??null,proposedValue:normalized});
      const active=await tx<CandidateRow[]>`SELECT * FROM af_product_change_candidates WHERE product_id=${c.productId}
        AND base_version_id=${c.baseVersionId} AND status IN ('detected','pending_review','approved') ORDER BY created_at,id`;
      const match=active.find(r=>semanticKey({productId:r.product_id,baseVersionId:r.base_version_id,candidateType:r.candidate_type,targetKey:r.target_key,targetRef:r.target_ref,proposedValue:r.proposed_value})===sem);
      if(match){
        await linkCandidateEvidence(tx,match.id,match.evidence_id);
        if(await linkCandidateEvidence(tx,match.id,evidence.id))await audit('worker','aifind.candidate.support','aifind:candidate:'+match.id,'Matching semantic proposal; independent evidence retained',null,{evidenceId:evidence.id,observationId:o.id,semanticKey:sem},{db:tx});
        ids.push(match.id);continue;
      }
      const [row]=await tx<CandidateRow[]>`INSERT INTO af_product_change_candidates
        (id,product_id,base_version_id,candidate_type,target_key,target_ref,proposed_value,evidence_id,source_type,status,observation_id,source_url,resolver_method,resolver_version,detector_version,prompt_version,resolver_receipt_id,detector_receipt_id,proposal_key,semantic_key)
        VALUES(${randomUUID()},${c.productId},${c.baseVersionId},${c.candidateType},${c.targetKey},${c.targetRef??null},${tx.json(normalizeProposal(c) as never)},${evidence.id},'detector','detected',
          ${o.id},${o.url},${resolution.method},${resolution.version},${DETECTOR_VERSION},${DETECTOR_PROMPT_VERSION},${resolution.receiptId},${response.receiptId},${key},${sem}) RETURNING *`;
      await linkCandidateEvidence(tx,row.id,evidence.id);
      await audit('worker','aifind.candidate.detected','aifind:candidate:'+row.id,'Evidence/schema/base validated',null,candidateDto(row),{db:tx});
      await tx`UPDATE af_product_change_candidates SET status='pending_review' WHERE id=${row.id}`;
      await audit('worker','aifind.candidate.pending_review','aifind:candidate:'+row.id,'Human review required',{status:'detected'},{status:'pending_review'},{db:tx});
      ids.push(row.id);
    }
    const result=await finishObservation(tx,o,{state:ids.length?'detected':'no_changes',baseVersionId:base.version.id,resolution,candidateIds:ids,unsupported:output.unsupportedObservations,receiptIds:receipts.map(String)});
    for(const receipt of receipts)await completeReceipt(tx,receipt);return result;
  });
}
async function fail(o:Observation,error:unknown,baseVersionId:string|null,resolution:import('../resolver/contracts.ts').ResolverResult):Promise<Observation> {
  const state=error instanceof BudgetExceededError?'budget_blocked':error instanceof ReceiptUnknownError?'receipt_unknown':'error';
  const receipt=(error as {receiptId?:number})?.receiptId;
  const result=await sql.begin('isolation level read committed',tx=>finishObservation(tx,o,{state,baseVersionId,resolution,reason:String(error),receiptIds:receipt?[String(receipt)]:[]}));
  if(error instanceof ReceiptUnknownError)throw error; // Existing receipt Recovery explicitly releases the failed job.
  return result;
}
