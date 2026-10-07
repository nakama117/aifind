import {sql} from '@aihot/backend/db';
import {assertPreviewWrites} from './config.ts';
import type {Monitor,Observation} from '../detector/contracts.ts';
import type {FetchResult} from '../detector/observations.ts';
import type {DetectorAdapter} from '../detector/detect.ts';
import {shutdownSignal} from '@aihot/backend/lib/shutdown';
export const PHASE4_SETTING='aifind.preview.phase4';
export const PHASE4_STALE_WAIT='aifind.preview.phase4.stale_waiting';
export interface StalePreviewWait {observationId:string;baseVersionId:string;deadlineAt:string}
export interface DetectorPreviewSeed {
  products:{main:string;ambiguous:string[];stale:string};
  fixtures:Array<{key:string;monitorId:string;text:string}>;
}
export async function detectorPreviewSeed():Promise<DetectorPreviewSeed|null> {
  const [s]=await sql<{value:DetectorPreviewSeed}[]>`SELECT value FROM settings WHERE key=${PHASE4_SETTING}`;return s?.value??null;
}
export async function syntheticFetch(m:Monitor,key:string):Promise<FetchResult> {
  assertPreviewWrites(process.env);
  const fixture=(await detectorPreviewSeed())?.fixtures.find(f=>f.key===key&&f.monitorId===m.id);
  if(!fixture||!m.url.startsWith('https://synthetic.invalid/aifind-phase4/'))throw new Error('Unregistered synthetic Preview fixture');
  return {text:fixture.text,httpStatus:200,fetchOutcome:'ok'};
}
export const syntheticDetector:DetectorAdapter=async(o:Observation,base)=>{
  assertPreviewWrites(process.env);
  const fixture=(await detectorPreviewSeed())?.fixtures.find(f=>f.monitorId===o.monitorId&&f.text===o.text);
  if(!fixture)throw new Error('Observation is not a registered synthetic fixture');
  if(fixture.key==='stale_commit'){
    const deadline=Date.now()+90_000,waiting:StalePreviewWait={observationId:o.id,baseVersionId:base.version.id,deadlineAt:new Date(deadline).toISOString()};
    await sql`INSERT INTO settings(key,value) VALUES(${PHASE4_STALE_WAIT},${sql.json(waiting as never)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
    // The synthetic worker only waits and reads. A separate administrator must publish.
    let changed=false;
    while(Date.now()<deadline){shutdownSignal.signal.throwIfAborted();const [current]=await sql`SELECT id FROM af_product_versions WHERE product_id=${base.identity.id} AND status='published'`;
      if(current?.id!==base.version.id){changed=true;break;}await new Promise(r=>setTimeout(r,100));}
    if(!changed)throw new Error('[PREVIEW] Human Publish wait expired; no Candidate was created');
  }
  const lines=o.text.split('\n');
  const proposal=JSON.parse(lines[1]) as {candidateType?:string;targetKey?:string;targetRef?:string;value?:Record<string,unknown>};
  // The short fixture quote is a typed source attestation, not pre-rendered HTML or a Candidate row.
  if(!proposal.value)return {output:{changes:[],unsupportedObservations:[],notes:[]},receiptId:null};
  const evidenceQuote=lines[2]??JSON.stringify(proposal.value),start=o.text.lastIndexOf(evidenceQuote);
  return {output:{changes:[{candidateType:proposal.candidateType,targetKey:proposal.targetKey,targetRef:proposal.targetRef??null,
    proposedValue:proposal.value,evidenceQuote,evidenceLocator:{start,end:start+evidenceQuote.length}}],unsupportedObservations:[],notes:[]},receiptId:null};
};
