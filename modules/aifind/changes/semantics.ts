import {createHash} from 'node:crypto';
import type {Tx} from '@aihot/backend/db';
import {stableJson} from '../detector/validate.ts';
export function semanticValue(value:Record<string,unknown>):Record<string,unknown>{
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['evidenceId','verifiedAt','lifecycleEvidenceId','lifecycleVerifiedAt'].includes(key)));
}
export function semanticKey(input:{productId:string;baseVersionId:string;candidateType:string;targetKey:string;targetRef:string|null;proposedValue:Record<string,unknown>}):string{
  const {productId,baseVersionId,candidateType,targetKey,targetRef}=input;
  return createHash('sha256').update(stableJson({productId,baseVersionId,candidateType,targetKey,targetRef,proposedValue:semanticValue(input.proposedValue)})).digest('hex');
}
export async function linkCandidateEvidence(tx:Tx,candidateId:string,evidenceId:string):Promise<boolean>{
  return (await tx`INSERT INTO af_candidate_supporting_evidence(candidate_id,evidence_id) VALUES(${candidateId},${evidenceId}) ON CONFLICT DO NOTHING RETURNING evidence_id`).length>0;
}
