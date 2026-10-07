import {sql} from '@aihot/backend/db';

/** Input remains while unfinished processing needs it; terminal inputs retain only immutable context. */
export async function pruneObservations(now:Date=new Date()):Promise<Record<string,unknown>>{
  return sql.begin('isolation level read committed',async tx=>{
    const rows=await tx`SELECT id FROM af_source_observations o WHERE pruned_at IS NULL AND source_text<>''
      AND state IN ('unchanged','fetch_failed','stale','unresolved','ambiguous','invalid','detected','no_changes')
      AND (retention_class='evidence_only' OR retention_expires_at<=${now})
      AND NOT EXISTS(SELECT 1 FROM af_evidence e WHERE e.observation_id=o.id AND NOT EXISTS(SELECT 1 FROM af_observation_evidence_context c WHERE c.evidence_id=e.id))
      AND pg_try_advisory_xact_lock(hashtextextended('af_observation_execution:' || o.id,0))
      ORDER BY retrieved_at,id LIMIT 1000 FOR UPDATE SKIP LOCKED`;
    if(rows.length)await tx`UPDATE af_source_observations SET source_text='',pruned_at=${now} WHERE id IN ${tx(rows.map(r=>r.id))}`;
    const [pending]=await tx`SELECT count(*)::int n FROM af_source_observations WHERE pruned_at IS NULL AND source_text<>'' AND retention_expires_at<=${now}`;
    return {aifindObservationsPruned:rows.length,aifindExpiredInputBlocked:pending.n};
  });
}
