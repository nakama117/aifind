import {z} from 'zod';
import {sql} from '@aihot/backend/db';
import {audit,Conflict} from '@aihot/backend/audit';
import {ReasonSchema} from '../admin/contracts.ts';
import {NotFound,InvalidInput} from '../admin/errors.ts';
import {monitorDto,type MonitorRow} from './monitors.ts';
import type {Monitor} from './contracts.ts';

export const SourcePolicySchema=z.strictObject({expectedRevision:z.number().int().min(1),status:z.enum(['unreviewed','approved','blocked']),
  retentionClass:z.enum(['evidence_only','short_excerpt']),excerptDays:z.number().int().min(1).max(365).default(30),
  allowAutomatedFetch:z.boolean(),allowJina:z.boolean(),reason:ReasonSchema});
export function assertMonitorPolicy(m:Monitor):void {
  if(m.sourcePolicy.status!=='approved'||!m.sourcePolicy.allowAutomatedFetch)throw new InvalidInput('Source policy の承認と automated fetch 許可が必要です。');
  if(m.allowJina&&!m.sourcePolicy.allowJina)throw new InvalidInput('Source policy の Jina 許可が必要です。');
}
/** Explicit operator review; approval is not a statement of legal certainty. */
export async function reviewSourcePolicy(id:string,input:unknown,actor:string):Promise<Monitor>{
  const p=SourcePolicySchema.parse(input);
  if(p.status!=='approved'&&(p.allowAutomatedFetch||p.allowJina))throw new InvalidInput('Unreviewed / blocked policy cannot grant automated permissions.');
  return sql.begin('isolation level read committed',async tx=>{
    const [before]=await tx<MonitorRow[]>`SELECT * FROM af_source_monitors WHERE id=${id} FOR UPDATE`;
    if(!before)throw new NotFound('Monitor が見つかりません。');if(before.revision!==p.expectedRevision)throw new Conflict('Source policy が更新されています。');
    const enabled=before.enabled&&p.status==='approved'&&p.allowAutomatedFetch&&(!before.allow_jina||p.allowJina);
    const [row]=await tx<MonitorRow[]>`UPDATE af_source_monitors SET policy_status=${p.status},retention_class=${p.retentionClass},excerpt_days=${p.excerptDays},
      policy_fetch_allowed=${p.allowAutomatedFetch},policy_jina_allowed=${p.allowJina},policy_reviewed_at=clock_timestamp(),policy_reviewed_by=${actor},policy_reason=${p.reason},
      enabled=${enabled},revision=revision+1,updated_at=clock_timestamp() WHERE id=${id} RETURNING *`;
    const result=monitorDto(row);await audit(actor,'aifind.source_policy.review','aifind:source-policy:'+id,p.reason,monitorDto(before).sourcePolicy,result.sourcePolicy,{db:tx});return result;
  });
}
