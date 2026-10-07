import {randomUUID} from 'node:crypto';
import {sql} from '@aihot/backend/db';
import type {Db} from '@aihot/backend/db';
import type {Monitor,Observation} from './contracts.ts';
import type {ResolverResult} from '../resolver/contracts.ts';
import {RESOLVER_VERSION} from '../resolver/contracts.ts';
import {DETECTOR_VERSION,DETECTOR_PROMPT_VERSION} from './contracts.ts';
import {sha256,stableJson} from './validate.ts';
import {NotFound} from '../admin/errors.ts';
import {completeReceipt} from '@aihot/backend/providers/receipts';

export interface ObservationRow {
  id:string;monitor_id:string;product_id:string|null;monitor_revision:number;url:string;source_kind:string;publisher:string;identity_hint:string|null;vendor_hint:string|null;
  retrieved_at:Date;published_at:Date|null;http_status:number|null;fetch_outcome:string;content_hash:string|null;input_hash:string;source_text:string;etag:string|null;last_modified:string|null;
  state:string;reason:string|null;base_version_id:string|null;resolution:ResolverResult|null;candidate_ids:string[];unsupported:string[];receipt_ids:string[];
  retention_class:Observation['retentionClass'];retention_expires_at:Date;pruned_at:Date|null;
}
export const observationDto=(o:ObservationRow):Observation=>({id:o.id,monitorId:o.monitor_id,productId:o.product_id,monitorRevision:o.monitor_revision,url:o.url,
  sourceKind:o.source_kind,publisher:o.publisher,identityHint:o.identity_hint,vendorHint:o.vendor_hint,retrievedAt:o.retrieved_at.toISOString(),publishedAt:o.published_at?.toISOString()??null,
  httpStatus:o.http_status,fetchOutcome:o.fetch_outcome,contentHash:o.content_hash,inputHash:o.input_hash,text:o.source_text,etag:o.etag,lastModified:o.last_modified,
  state:o.state,reason:o.reason,baseVersionId:o.base_version_id,resolution:o.resolution,candidateIds:o.candidate_ids,unsupported:o.unsupported,receiptIds:o.receipt_ids,
  retentionClass:o.retention_class,retentionExpiresAt:o.retention_expires_at.toISOString(),prunedAt:o.pruned_at?.toISOString()??null});
export interface FetchResult {text:string;httpStatus:number|null;fetchOutcome:'ok'|'blocked'|'not_found'|'timeout'|'error'|'empty';reason?:string;etag?:string|null;lastModified?:string|null;retrievedAt?:string;publishedAt?:string|null;receiptId?:number}
export async function recordObservation(m:Monitor,result:FetchResult):Promise<Observation> {
  const ok=result.fetchOutcome==='ok' && result.httpStatus!==null && result.httpStatus>=200 && result.httpStatus<300 && !!result.text.trim();
  const text=ok?result.text.slice(0,12000):'',hash=ok?sha256(result.text):null,at=result.retrievedAt??new Date().toISOString();
  const outcome=ok?'ok':result.fetchOutcome==='ok'?'empty':result.fetchOutcome;
  const inputHash=sha256(stableJson({url:m.url,monitorRevision:m.revision,identity:m.identityHint,vendor:m.vendorHint,product:m.productId,hash}));
  return sql.begin('isolation level read committed',async tx=>{
    const [current]=await tx`SELECT revision,last_content_hash,retention_class,excerpt_days FROM af_source_monitors WHERE id=${m.id} FOR UPDATE`;
    if(!current)throw new NotFound('Monitor が見つかりません。');
    const [previous]=ok?await tx`SELECT input_hash FROM af_source_observations WHERE monitor_id=${m.id} AND fetch_outcome='ok' ORDER BY retrieved_at DESC,created_at DESC,id DESC LIMIT 1`:[];
    const state=!ok?'fetch_failed':current.revision!==m.revision?'stale':current.last_content_hash===hash&&previous?.input_hash===inputHash?'unchanged':'observed';
    const [o]=await tx<ObservationRow[]>`INSERT INTO af_source_observations(id,monitor_id,product_id,monitor_revision,url,source_kind,publisher,identity_hint,vendor_hint,
      retrieved_at,published_at,http_status,fetch_outcome,content_hash,input_hash,source_text,etag,last_modified,state,reason,receipt_ids,retention_class,retention_days,retention_expires_at)
      VALUES(${randomUUID()},${m.id},${m.productId},${m.revision},${m.url},${m.sourceKind},${m.publisher},${m.identityHint},${m.vendorHint},${at},${result.publishedAt??null},
        ${result.httpStatus},${outcome},${hash},${inputHash},${text},${result.etag?.slice(0,500)??null},${result.lastModified?.slice(0,500)??null},${state},${result.reason?.slice(0,1000)??null},${result.receiptId?[String(result.receiptId)]:[]},
        ${current.retention_class},${current.excerpt_days},${at}::timestamptz+${current.excerpt_days}*interval '1 day') RETURNING *`;
    if(current.revision===m.revision) await tx`UPDATE af_source_monitors SET last_check_at=${at},last_success_at=${ok?at:tx`last_success_at`},
      last_changed_at=${ok && state==='observed'?at:tx`last_changed_at`},last_content_hash=${ok?hash:tx`last_content_hash`},last_error=${ok?null:result.reason?.slice(0,1000)??outcome},
      next_check_at=${at}::timestamptz+cadence_minutes*interval '1 minute' WHERE id=${m.id}`;
    if(result.receiptId)await completeReceipt(tx,result.receiptId);
    return observationDto(o);
  });
}
export async function readObservation(id:string,db:Db=sql):Promise<Observation> {
  const [o]=await db<ObservationRow[]>`SELECT * FROM af_source_observations WHERE id=${id}`;
  if(!o)throw new NotFound('Observation が見つかりません。');return observationDto(o);
}
export async function finishObservation(db:Db,o:Observation,result:{state:string;reason?:string|null;baseVersionId?:string|null;resolution?:ResolverResult|null;candidateIds?:string[];unsupported?:string[];receiptIds?:string[]}):Promise<Observation> {
  const r={state:result.state,reason:result.reason?.slice(0,1000)??null,baseVersionId:result.baseVersionId??null,resolution:result.resolution??null,candidateIds:result.candidateIds??[],unsupported:result.unsupported??[],receiptIds:[...new Set([...o.receiptIds,...result.receiptIds??[]])]};
  await db`INSERT INTO af_observation_runs(id,observation_id,state,reason,base_version_id,resolver_version,detector_version,prompt_version,resolution,candidate_ids,unsupported,receipt_ids)
    VALUES(${randomUUID()},${o.id},${r.state},${r.reason},${r.baseVersionId},${RESOLVER_VERSION},${DETECTOR_VERSION},${DETECTOR_PROMPT_VERSION},${r.resolution?db.json(r.resolution as never):null},${r.candidateIds},${r.unsupported},${r.receiptIds})`;
  await db`UPDATE af_source_observations SET state=${r.state},reason=${r.reason},base_version_id=${r.baseVersionId},resolution=${r.resolution?db.json(r.resolution as never):null},
    candidate_ids=${r.candidateIds},unsupported=${r.unsupported},receipt_ids=${r.receiptIds} WHERE id=${o.id}`;
  return readObservation(o.id,db);
}
