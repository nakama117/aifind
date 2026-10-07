import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {sql} from '@aihot/backend/db';
import {audit,Conflict} from '@aihot/backend/audit';
import {defineQueue} from '@aihot/backend/modules';
import {enqueueOn,recordRun} from '@aihot/backend/jobs/queue';
import {ActionSchema} from '../admin/contracts.ts';
import {readMonitor} from './monitors.ts';
import {recordObservation} from './observations.ts';
import {fetchMonitor} from './fetch.ts';
import {processObservation} from './detect.ts';
import {syntheticFetch,syntheticDetector} from '../preview/detector-fixtures.ts';
import {assertMonitorPolicy} from './source-policy.ts';

export const detectorEnabled=()=>process.env.COLLECT_ENABLED==='true'&&process.env.AIFIND_DETECTOR_ENABLED==='true';
const ObserveDataSchema=z.strictObject({monitorId:z.string().min(1).max(80),requestKey:z.string().min(1).max(80),fixtureKey:z.string().max(80).optional()});
const DetectDataSchema=z.strictObject({observationId:z.string().min(1).max(80),synthetic:z.boolean().optional()});
export async function observeMonitor(monitorId:string,requestKey:string=randomUUID(),fixtureKey?:string):Promise<{skipped?:string;observationId?:string;state?:string}> {
  if(!fixtureKey&&!detectorEnabled())return {skipped:'disabled'};
  const m=await readMonitor(monitorId);if(!fixtureKey&&!m.enabled)return {skipped:'monitor_disabled'};
  if(!fixtureKey)assertMonitorPolicy(m);
  const fetched=fixtureKey?await syntheticFetch(m,fixtureKey):await fetchMonitor(m,requestKey);
  const o=await recordObservation(m,fetched);
  // Recover incomplete processing using the same immutable input and paid logical receipt.
  const pending=o.state==='observed'?[{id:o.id}]:o.state==='unchanged'?await sql`SELECT id FROM af_source_observations WHERE monitor_id=${m.id}
    AND input_hash=${o.inputHash} AND state IN ('observed','model_disabled','budget_blocked','error') ORDER BY retrieved_at,id LIMIT 1`:[];
  if(pending.length)await enqueueOn(detectQueue,{observationId:pending[0].id,...(fixtureKey?{synthetic:true}:{})},{singletonKey:pending[0].id});
  return {observationId:o.id,state:o.state};
}
export const observeQueue=defineQueue<z.infer<typeof ObserveDataSchema>>({name:'aifind.observe',options:{policy:'short',retryLimit:0,expireInSeconds:180},worker:{localConcurrency:1,batchSize:1},
  run:async data=>recordRun('aifind.observe',()=>{const d=ObserveDataSchema.parse(data);return observeMonitor(d.monitorId,d.requestKey,d.fixtureKey);})});
export const detectQueue=defineQueue<z.infer<typeof DetectDataSchema>>({name:'aifind.detect',options:{policy:'short',retryLimit:0,expireInSeconds:600},worker:{localConcurrency:1,batchSize:1},
  run:async data=>recordRun('aifind.detect',async()=>{const d=DetectDataSchema.parse(data);if(!d.synthetic&&!detectorEnabled())return {skipped:'disabled'};
    return processObservation(d.observationId,d.synthetic?{adapter:syntheticDetector}:{});})});
export async function queueMonitorRun(id:string,input:unknown,actor:string,options:{allowDisabled?:boolean;fixtureKey?:string}={}):Promise<{jobId:string|null;duplicate:boolean}> {
  const {reason}=ActionSchema.parse(input);const monitor=await readMonitor(id);
  if(!options.fixtureKey)assertMonitorPolicy(monitor);
  if(!options.allowDisabled&&!options.fixtureKey&&!detectorEnabled())throw new Conflict('COLLECT_ENABLED / AIFIND_DETECTOR_ENABLED は閉じています。');
  return sql.begin('isolation level read committed',async tx=>{
    const jobId=await enqueueOn(observeQueue,{monitorId:id,requestKey:randomUUID(),...(options.fixtureKey?{fixtureKey:options.fixtureKey}:{})},{singletonKey:id},tx);
    if(jobId)await audit(actor,'aifind.monitor.enqueue','aifind:monitor:'+id,reason,null,{jobId},{db:tx});
    return {jobId,duplicate:jobId===null};
  });
}
export async function enqueueDueMonitors():Promise<{enqueued:number;skipped?:string}> {
  if(!detectorEnabled())return {enqueued:0,skipped:'disabled'};
  const rows=await sql`SELECT id FROM af_source_monitors WHERE enabled AND next_check_at<=clock_timestamp() ORDER BY next_check_at,id LIMIT 50`;
  let count=0;for(const row of rows)if((await queueMonitorRun(row.id,{reason:'Asia/Tokyo schedule'},'worker')).jobId)count++;
  return {enqueued:count};
}
