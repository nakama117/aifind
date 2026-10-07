import {sql} from '@aihot/backend/db';
import {detectorPreviewSeed,PHASE4_STALE_WAIT} from './detector-fixtures.ts';
import type {StalePreviewWait} from './detector-fixtures.ts';
import {readAdminProduct} from '../admin/read.ts';
import {readCandidate} from '../changes/candidates.ts';
import {readObservation} from '../detector/observations.ts';
import {listMonitors} from '../detector/monitors.ts';
import type {ProductAdminDetail,CandidateDetail} from '../admin/contracts.ts';
import type {Monitor,Observation} from '../detector/contracts.ts';
import {assertPreviewWrites} from './config.ts';
import {detectQueue} from '../detector/jobs.ts';
import {enqueueOn} from '@aihot/backend/jobs/queue';
import {audit} from '@aihot/backend/audit';
import {InvalidInput} from '../admin/errors.ts';
export interface DetectorPreview {
  seeded:boolean;main:ProductAdminDetail;stale:ProductAdminDetail;monitors:Monitor[];observations:Observation[];candidates:CandidateDetail[];
  fixtures:Array<{key:string;monitorId:string}>;canRun:boolean;staleWait:StalePreviewWait|null;
}
export async function readDetectorPreview():Promise<DetectorPreview|null> {
  const seed=await detectorPreviewSeed();if(!seed)return null;
  const monitorIds=seed.fixtures.map(f=>f.monitorId);
  const rows=await sql`SELECT id FROM af_source_observations WHERE monitor_id IN ${sql(monitorIds)} ORDER BY retrieved_at DESC,id LIMIT 30`;
  const observations=await Promise.all(rows.map(r=>readObservation(r.id)));
  const candidates=await sql`SELECT id FROM af_product_change_candidates WHERE observation_id IN ${sql(observations.map(o=>o.id))} ORDER BY created_at DESC,id`;
  const {canWritePreview}=await import('./service.ts');
  const [waiting]=await sql<{value:StalePreviewWait}[]>`SELECT value FROM settings WHERE key=${PHASE4_STALE_WAIT}`;
  return {seeded:true,main:await readAdminProduct(seed.products.main),stale:await readAdminProduct(seed.products.stale),
    monitors:(await listMonitors()).filter(m=>monitorIds.includes(m.id)),observations,candidates:await Promise.all(candidates.map(c=>readCandidate(c.id))),
    fixtures:seed.fixtures.map(({key,monitorId})=>({key,monitorId})),canRun:canWritePreview(),staleWait:waiting?.value??null};
}
/** Replay only a completed, registered synthetic input. No arbitrary Observation IDs from HTTP. */
export async function repeatPreviewObservation(reason:string,actor:string):Promise<{jobId:string|null;duplicate:boolean;observationId:string}> {
  assertPreviewWrites(process.env);const fixture=(await detectorPreviewSeed())?.fixtures.find(f=>f.key==='main');
  if(!fixture)throw new InvalidInput('Preview seed が必要です。');
  return sql.begin('isolation level read committed',async tx=>{
    const [o]=await tx`SELECT id FROM af_source_observations WHERE monitor_id=${fixture.monitorId} AND source_text=${fixture.text} AND state IN ('detected','no_changes') ORDER BY retrieved_at,id LIMIT 1`;
    if(!o)throw new InvalidInput('先に価格変更ケースを完了してください。');
    const jobId=await enqueueOn(detectQueue,{observationId:o.id,synthetic:true},{singletonKey:o.id},tx);
    if(jobId)await audit(actor,'aifind.preview.detect.repeat','aifind:observation:'+o.id,reason,null,{jobId},{db:tx});
    return {jobId,duplicate:jobId===null,observationId:o.id};
  });
}
