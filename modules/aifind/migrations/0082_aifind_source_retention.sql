-- Operator review records, not a legal determination. Legacy sources need review before re-enable.
ALTER TABLE af_source_monitors
  ADD COLUMN policy_status text NOT NULL DEFAULT 'unreviewed' CHECK(policy_status IN ('unreviewed','approved','blocked')),
  ADD COLUMN retention_class text NOT NULL DEFAULT 'evidence_only' CHECK(retention_class IN ('evidence_only','short_excerpt')),
  ADD COLUMN excerpt_days integer NOT NULL DEFAULT 30 CHECK(excerpt_days BETWEEN 1 AND 365),
  ADD COLUMN policy_fetch_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN policy_jina_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN policy_reviewed_at timestamptz,
  ADD COLUMN policy_reviewed_by text,
  ADD COLUMN policy_reason text CHECK(length(policy_reason)<=500);
UPDATE af_source_monitors SET enabled=false,revision=revision+1,updated_at=clock_timestamp() WHERE enabled;
ALTER TABLE af_source_monitors
  ADD CONSTRAINT af_source_review_identity CHECK(policy_status='unreviewed' OR
    (policy_reviewed_at IS NOT NULL AND length(btrim(policy_reviewed_by))>0 AND length(btrim(policy_reason))>0)),
  ADD CONSTRAINT af_source_enable_policy CHECK(NOT enabled OR
    (policy_status='approved' AND policy_fetch_allowed AND (NOT allow_jina OR policy_jina_allowed)));
CREATE FUNCTION af_guard_source_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.url IS DISTINCT FROM OLD.url THEN
    NEW.policy_status='unreviewed'; NEW.policy_fetch_allowed=false; NEW.policy_jina_allowed=false;
    NEW.policy_reviewed_at=NULL; NEW.policy_reviewed_by=NULL; NEW.policy_reason=NULL; NEW.enabled=false;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_source_policy_url BEFORE UPDATE ON af_source_monitors FOR EACH ROW EXECUTE FUNCTION af_guard_source_policy();

-- New metadata is filled in this forward migration before reinstalling the stricter input guard.
DROP TRIGGER af_observation_guard ON af_source_observations;
ALTER TABLE af_source_observations
  ADD COLUMN retention_class text NOT NULL DEFAULT 'evidence_only' CHECK(retention_class IN ('evidence_only','short_excerpt')),
  ADD COLUMN retention_days integer NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 365),
  ADD COLUMN retention_expires_at timestamptz,
  ADD COLUMN pruned_at timestamptz;
UPDATE af_source_observations SET retention_expires_at=retrieved_at+retention_days*interval '1 day';
ALTER TABLE af_source_observations ALTER COLUMN retention_expires_at SET NOT NULL;

CREATE TABLE af_observation_evidence_context (
  evidence_id text PRIMARY KEY REFERENCES af_evidence(id) ON DELETE RESTRICT,
  observation_id text NOT NULL REFERENCES af_source_observations(id) ON DELETE RESTRICT,
  evidence_quote text NOT NULL CHECK(length(evidence_quote) BETWEEN 1 AND 500),
  context_before text NOT NULL CHECK(length(context_before)<=160),
  context_after text NOT NULL CHECK(length(context_after)<=160),
  locator_start integer NOT NULL CHECK(locator_start>=0), locator_end integer NOT NULL CHECK(locator_end>locator_start),
  source_length integer NOT NULL CHECK(source_length>=locator_end),
  retained_input_hash text NOT NULL CHECK(retained_input_hash ~ '^[a-f0-9]{64}$'),
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$')
);
INSERT INTO af_observation_evidence_context
  SELECT e.id,o.id,e.evidence_quote,
    substring(o.source_text FROM greatest(1,e.locator_start-159) FOR least(160,e.locator_start)),
    substring(o.source_text FROM e.locator_end+1 FOR 160),e.locator_start,e.locator_end,length(o.source_text),
    encode(sha256(convert_to(o.source_text,'UTF8')),'hex'),o.content_hash
  FROM af_evidence e JOIN af_source_observations o ON o.id=e.observation_id
  WHERE e.evidence_quote=substring(o.source_text FROM e.locator_start+1 FOR e.locator_end-e.locator_start)
    AND e.content_hash=o.content_hash;
CREATE TRIGGER af_context_immutable BEFORE UPDATE OR DELETE ON af_observation_evidence_context FOR EACH ROW EXECUTE FUNCTION af_keep_evidence();
CREATE FUNCTION af_validate_evidence_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM af_evidence e JOIN af_source_observations o ON o.id=e.observation_id
    WHERE e.id=NEW.evidence_id AND o.id=NEW.observation_id AND o.pruned_at IS NULL
      AND NEW.evidence_quote=e.evidence_quote AND NEW.locator_start=e.locator_start AND NEW.locator_end=e.locator_end
      AND NEW.evidence_quote=substring(o.source_text FROM e.locator_start+1 FOR e.locator_end-e.locator_start)
      AND NEW.context_before=substring(o.source_text FROM greatest(1,e.locator_start-159) FOR least(160,e.locator_start))
      AND NEW.context_after=substring(o.source_text FROM e.locator_end+1 FOR 160)
      AND NEW.source_length=length(o.source_text)
      AND NEW.retained_input_hash=encode(sha256(convert_to(o.source_text,'UTF8')),'hex')
      AND NEW.content_hash=o.content_hash AND e.content_hash=o.content_hash)
    THEN RAISE EXCEPTION 'evidence context requires original matching retained input' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_context_insert BEFORE INSERT ON af_observation_evidence_context FOR EACH ROW EXECUTE FUNCTION af_validate_evidence_context();

DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint WHERE conrelid='af_source_observations'::regclass
    AND pg_get_constraintdef(oid) LIKE '%content_hash IS NOT NULL%';
  IF c IS NULL THEN RAISE EXCEPTION 'expected observation fetch constraint'; END IF;
  EXECUTE format('ALTER TABLE af_source_observations DROP CONSTRAINT %I',c);
END $$;
ALTER TABLE af_source_observations ADD CONSTRAINT af_observation_retained_fetch CHECK(
  (fetch_outcome='ok' AND http_status BETWEEN 200 AND 299 AND content_hash IS NOT NULL
    AND ((pruned_at IS NULL AND length(btrim(source_text))>0) OR (pruned_at IS NOT NULL AND source_text='')))
  OR (fetch_outcome<>'ok' AND content_hash IS NULL AND source_text='' AND pruned_at IS NULL));
CREATE OR REPLACE FUNCTION af_guard_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'observation history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF OLD.pruned_at IS NULL AND NEW.pruned_at IS NOT NULL AND OLD.source_text<>'' AND NEW.source_text=''
    AND OLD.state IN ('unchanged','fetch_failed','stale','unresolved','ambiguous','invalid','detected','no_changes')
    AND (OLD.retention_class='evidence_only' OR NEW.pruned_at>=OLD.retention_expires_at)
    AND (to_jsonb(NEW)-'source_text'-'pruned_at')=(to_jsonb(OLD)-'source_text'-'pruned_at')
    AND NOT EXISTS (SELECT 1 FROM af_evidence e WHERE e.observation_id=OLD.id
      AND NOT EXISTS (SELECT 1 FROM af_observation_evidence_context c WHERE c.evidence_id=e.id AND c.observation_id=OLD.id))
    THEN RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-'state'-'reason'-'base_version_id'-'resolution'-'candidate_ids'-'unsupported'-'receipt_ids') IS DISTINCT FROM
     (to_jsonb(OLD)-'state'-'reason'-'base_version_id'-'resolution'-'candidate_ids'-'unsupported'-'receipt_ids') THEN
    RAISE EXCEPTION 'observation input is immutable except one-way safe retention prune' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_observation_guard BEFORE UPDATE OR DELETE ON af_source_observations FOR EACH ROW EXECUTE FUNCTION af_guard_observation();
CREATE INDEX af_observations_retention ON af_source_observations(retention_expires_at,id) WHERE pruned_at IS NULL AND source_text<>'';
