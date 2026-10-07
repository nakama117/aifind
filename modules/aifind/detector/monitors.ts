import {randomUUID} from 'node:crypto';
import {sql,type Tx} from '@aihot/backend/db';
import {audit,Conflict} from '@aihot/backend/audit';
import {isBlockedAddress} from '@aihot/backend/lib/url';
import {config} from '@aihot/backend/config';
import {MonitorSchema,MonitorEditSchema} from './contracts.ts';
import type {Monitor} from './contracts.ts';
import {NotFound,InvalidInput} from '../admin/errors.ts';
import {assertMonitorPolicy} from './source-policy.ts';

export type MonitorRow={id:string;product_id:string|null;url:string;source_kind:string;publisher:string;identity_hint:string|null;vendor_hint:string|null;
  enabled:boolean;cadence_minutes:number;allow_jina:boolean;revision:number;next_check_at:Date|null;last_check_at:Date|null;last_success_at:Date|null;
  last_changed_at:Date|null;last_content_hash:string|null;last_error:string|null;policy_status:Monitor['sourcePolicy']['status'];retention_class:Monitor['sourcePolicy']['retentionClass'];excerpt_days:number;
  policy_fetch_allowed:boolean;policy_jina_allowed:boolean;policy_reviewed_at:Date|null;policy_reviewed_by:string|null;policy_reason:string|null};
export const monitorDto=(m:MonitorRow):Monitor=>({id:m.id,productId:m.product_id,url:m.url,sourceKind:m.source_kind,publisher:m.publisher,
  identityHint:m.identity_hint,vendorHint:m.vendor_hint,enabled:m.enabled,cadenceMinutes:m.cadence_minutes,allowJina:m.allow_jina,revision:m.revision,
  nextCheckAt:m.next_check_at?.toISOString()??null,lastCheckAt:m.last_check_at?.toISOString()??null,lastSuccessAt:m.last_success_at?.toISOString()??null,
  lastChangedAt:m.last_changed_at?.toISOString()??null,lastContentHash:m.last_content_hash,lastError:m.last_error,
  sourcePolicy:{status:m.policy_status,retentionClass:m.retention_class,excerptDays:m.excerpt_days,allowAutomatedFetch:m.policy_fetch_allowed,
    allowJina:m.policy_jina_allowed,reviewedAt:m.policy_reviewed_at?.toISOString()??null,reviewedBy:m.policy_reviewed_by,reason:m.policy_reason}});
/** Synchronous registration rejects literal internal destinations; guardedFetch checks DNS on every request. */
export function validateMonitorUrl(text:string):void {
  const u=new URL(text),host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||text.length>2000)throw new InvalidInput('公開 HTTP(S) URL が必要です。');
  if(!config.allowPrivateNetworkFetch && (host==='localhost'||host.endsWith('.localhost')||host.endsWith('.internal')||(/^[\d.:]+$/.test(host)&&isBlockedAddress(host))))throw new InvalidInput('内部ネットワークは登録できません。');
}
export async function readMonitor(id:string):Promise<Monitor> {
  const [m]=await sql<MonitorRow[]>`SELECT * FROM af_source_monitors WHERE id=${id}`;
  if(!m)throw new NotFound('Monitor が見つかりません。');return monitorDto(m);
}
export async function listMonitors(productId?:string):Promise<Monitor[]> {
  const rows=await sql<MonitorRow[]>`SELECT * FROM af_source_monitors WHERE ${productId?sql`product_id=${productId}`:sql`TRUE`} ORDER BY created_at DESC,id LIMIT 100`;
  return rows.map(monitorDto);
}
export async function createMonitor(input:unknown,actor:string,db?:Tx):Promise<Monitor> {
  const m=MonitorSchema.parse(input);validateMonitorUrl(m.url);
  if(m.enabled)throw new InvalidInput('Source policy を先に承認してください。登録時は disabled が必要です。');
  const create=async (tx:Tx)=>{
    const [row]=await tx<MonitorRow[]>`INSERT INTO af_source_monitors(id,product_id,url,source_kind,publisher,identity_hint,vendor_hint,enabled,allow_jina,cadence_minutes,next_check_at)
      VALUES(${randomUUID()},${m.productId},${m.url},${m.sourceKind},${m.publisher},${m.identityHint},${m.vendorHint},${m.enabled},${m.allowJina},${m.cadenceMinutes},clock_timestamp()) RETURNING *`;
    const result=monitorDto(row);await audit(actor,'aifind.monitor.create','aifind:monitor:'+row.id,m.reason,null,result,{db:tx});return result;
  };
  return db?create(db):sql.begin('isolation level read committed',create);
}
export async function updateMonitor(id:string,input:unknown,actor:string):Promise<Monitor> {
  const edit=MonitorEditSchema.parse(input);
  return sql.begin('isolation level read committed',async tx=>{
    const [before]=await tx<MonitorRow[]>`SELECT * FROM af_source_monitors WHERE id=${id} FOR UPDATE`;
    if(!before)throw new NotFound('Monitor が見つかりません。');if(before.revision!==edit.expectedRevision)throw new Conflict('Monitor が更新されています。再読み込みしてください。');
    const m={...monitorDto(before),...edit};validateMonitorUrl(m.url);
    if(m.enabled&&m.url===before.url)assertMonitorPolicy(m);
    const [row]=await tx<MonitorRow[]>`UPDATE af_source_monitors SET product_id=${m.productId},url=${m.url},source_kind=${m.sourceKind},publisher=${m.publisher},
      identity_hint=${m.identityHint},vendor_hint=${m.vendorHint},enabled=${m.enabled},allow_jina=${m.allowJina},cadence_minutes=${m.cadenceMinutes},
      revision=revision+1,updated_at=clock_timestamp(),next_check_at=clock_timestamp() WHERE id=${id} RETURNING *`;
    const result=monitorDto(row);await audit(actor,edit.enabled===undefined?'aifind.monitor.update':edit.enabled?'aifind.monitor.enable':'aifind.monitor.disable',
      'aifind:monitor:'+id,edit.reason,monitorDto(before),result,{db:tx});return result;
  });
}
