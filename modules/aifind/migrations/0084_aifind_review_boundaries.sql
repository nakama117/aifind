-- Forward hardening: explicit operator identity and prune/worker execution serialization.
ALTER TABLE af_source_monitors DROP CONSTRAINT af_source_review_identity;
ALTER TABLE af_source_monitors ADD CONSTRAINT af_source_review_identity CHECK(policy_status='unreviewed' OR
  (policy_reviewed_at IS NOT NULL AND policy_reviewed_by IS NOT NULL AND policy_reason IS NOT NULL
    AND length(btrim(policy_reviewed_by))>0 AND length(btrim(policy_reason))>0));

CREATE OR REPLACE FUNCTION af_guard_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'observation history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF OLD.pruned_at IS NULL AND NEW.pruned_at IS NOT NULL AND OLD.source_text<>'' AND NEW.source_text=''
    AND OLD.state IN ('unchanged','fetch_failed','stale','unresolved','ambiguous','invalid','detected','no_changes')
    AND (OLD.retention_class='evidence_only' OR NEW.pruned_at>=OLD.retention_expires_at)
    AND (to_jsonb(NEW)-'source_text'-'pruned_at')=(to_jsonb(OLD)-'source_text'-'pruned_at')
    AND NOT EXISTS (SELECT 1 FROM af_evidence e WHERE e.observation_id=OLD.id
      AND NOT EXISTS (SELECT 1 FROM af_observation_evidence_context c WHERE c.evidence_id=e.id AND c.observation_id=OLD.id))
    AND pg_try_advisory_xact_lock(hashtextextended('af_observation_execution:' || OLD.id,0))
    THEN RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-'state'-'reason'-'base_version_id'-'resolution'-'candidate_ids'-'unsupported'-'receipt_ids') IS DISTINCT FROM
     (to_jsonb(OLD)-'state'-'reason'-'base_version_id'-'resolution'-'candidate_ids'-'unsupported'-'receipt_ids') THEN
    RAISE EXCEPTION 'observation input is immutable except one-way safe retention prune outside processing' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
