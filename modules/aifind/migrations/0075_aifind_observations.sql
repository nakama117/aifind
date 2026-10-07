CREATE TABLE af_source_monitors (
  id text PRIMARY KEY,
  product_id text REFERENCES af_products(id) ON DELETE RESTRICT,
  url text NOT NULL CHECK(url ~ '^https?://' AND length(url)<=2000),
  source_kind text NOT NULL CHECK(source_kind IN ('official_product','official_pricing','official_docs','official_support','official_blog','official_terms','reputable_media','other')),
  publisher text NOT NULL CHECK(length(btrim(publisher)) BETWEEN 1 AND 200),
  identity_hint text CHECK(length(identity_hint)<=200), vendor_hint text CHECK(length(vendor_hint)<=200),
  enabled boolean NOT NULL DEFAULT false, allow_jina boolean NOT NULL DEFAULT false,
  cadence_minutes integer NOT NULL DEFAULT 1440 CHECK(cadence_minutes BETWEEN 60 AND 43200),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  next_check_at timestamptz, last_check_at timestamptz, last_success_at timestamptz, last_changed_at timestamptz,
  last_content_hash text CHECK(last_content_hash ~ '^[a-f0-9]{64}$'), last_error text CHECK(length(last_error)<=1000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX af_monitors_due ON af_source_monitors(next_check_at,id) WHERE enabled;
CREATE INDEX af_monitors_product ON af_source_monitors(product_id,id);

CREATE TABLE af_source_observations (
  id text PRIMARY KEY, monitor_id text NOT NULL REFERENCES af_source_monitors(id) ON DELETE RESTRICT,
  product_id text REFERENCES af_products(id) ON DELETE RESTRICT,
  monitor_revision integer NOT NULL CHECK(monitor_revision>0),
  url text NOT NULL CHECK(url ~ '^https?://'), source_kind text NOT NULL, publisher text NOT NULL,
  identity_hint text, vendor_hint text,
  retrieved_at timestamptz NOT NULL, published_at timestamptz,
  http_status integer CHECK(http_status BETWEEN 100 AND 599),
  fetch_outcome text NOT NULL CHECK(fetch_outcome IN ('ok','blocked','not_found','timeout','error','empty')),
  content_hash text CHECK(content_hash ~ '^[a-f0-9]{64}$'), input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  source_text text NOT NULL CHECK(length(source_text)<=12000), etag text, last_modified text,
  state text NOT NULL CHECK(state IN ('observed','unchanged','fetch_failed','unresolved','ambiguous','model_disabled','detected','no_changes','invalid','stale','error','budget_blocked','receipt_unknown')),
  reason text CHECK(length(reason)<=1000), base_version_id text REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  resolution jsonb CHECK(resolution IS NULL OR (jsonb_typeof(resolution)='object' AND resolution->>'status' IN ('resolved','ambiguous','unresolved'))),
  candidate_ids text[] NOT NULL DEFAULT '{}', unsupported text[] NOT NULL DEFAULT '{}', receipt_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK((fetch_outcome='ok' AND http_status BETWEEN 200 AND 299 AND content_hash IS NOT NULL AND length(btrim(source_text))>0)
    OR (fetch_outcome<>'ok' AND content_hash IS NULL AND source_text=''))
);
CREATE INDEX af_observations_monitor ON af_source_observations(monitor_id,retrieved_at DESC,id);
CREATE FUNCTION af_guard_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'observation history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW)-'state'-'reason'-'base_version_id'-'resolution'-'candidate_ids'-'unsupported'-'receipt_ids') IS DISTINCT FROM
     (to_jsonb(OLD)-'state'-'reason'-'base_version_id'-'resolution'-'candidate_ids'-'unsupported'-'receipt_ids') THEN
    RAISE EXCEPTION 'observation input is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_observation_guard BEFORE UPDATE OR DELETE ON af_source_observations FOR EACH ROW EXECUTE FUNCTION af_guard_observation();

CREATE TABLE af_observation_runs (
  id text PRIMARY KEY, observation_id text NOT NULL REFERENCES af_source_observations(id) ON DELETE RESTRICT,
  state text NOT NULL, reason text CHECK(length(reason)<=1000), base_version_id text REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  resolver_version text NOT NULL, detector_version text NOT NULL, prompt_version text NOT NULL,
  resolution jsonb, candidate_ids text[] NOT NULL DEFAULT '{}', unsupported text[] NOT NULL DEFAULT '{}', receipt_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER af_observation_run_immutable BEFORE UPDATE OR DELETE ON af_observation_runs FOR EACH ROW EXECUTE FUNCTION af_keep_evidence();

ALTER TABLE af_evidence ADD COLUMN observation_id text REFERENCES af_source_observations(id) ON DELETE RESTRICT,
  ADD COLUMN evidence_quote text CHECK(length(evidence_quote) BETWEEN 1 AND 500),
  ADD COLUMN locator_start integer, ADD COLUMN locator_end integer,
  ADD CONSTRAINT af_evidence_locator CHECK((observation_id IS NULL AND evidence_quote IS NULL AND locator_start IS NULL AND locator_end IS NULL)
    OR (observation_id IS NOT NULL AND evidence_quote IS NOT NULL AND locator_start>=0 AND locator_end>locator_start));

ALTER TABLE af_product_change_candidates ADD COLUMN observation_id text REFERENCES af_source_observations(id) ON DELETE RESTRICT,
  ADD COLUMN source_url text, ADD COLUMN resolver_method text, ADD COLUMN resolver_version text,
  ADD COLUMN detector_version text, ADD COLUMN prompt_version text,
  ADD COLUMN resolver_receipt_id bigint REFERENCES receipts(id) ON DELETE RESTRICT,
  ADD COLUMN detector_receipt_id bigint REFERENCES receipts(id) ON DELETE RESTRICT,
  ADD COLUMN proposal_key text UNIQUE CHECK(proposal_key ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT af_detector_provenance CHECK(source_type<>'detector' OR
    (observation_id IS NOT NULL AND source_url IS NOT NULL AND resolver_method IS NOT NULL AND resolver_version IS NOT NULL
      AND detector_version IS NOT NULL AND prompt_version IS NOT NULL AND proposal_key IS NOT NULL));
CREATE FUNCTION af_guard_detector_candidate_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.source_type='detector' THEN
    IF NEW.status<>'detected' THEN RAISE EXCEPTION 'detector candidate starts detected' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM af_evidence e JOIN af_source_observations o ON o.id=e.observation_id
      WHERE e.id=NEW.evidence_id AND o.id=NEW.observation_id AND o.fetch_outcome='ok' AND e.content_hash=o.content_hash
        AND e.url=o.url AND e.retrieved_at=o.retrieved_at AND e.evidence_quote=substring(o.source_text FROM e.locator_start+1 FOR e.locator_end-e.locator_start))
      THEN RAISE EXCEPTION 'detector requires matching observation evidence' USING ERRCODE='23514'; END IF;
    IF (NEW.proposed_value->>'verifiedAt') IS NOT NULL OR (NEW.proposed_value->>'lifecycleVerifiedAt') IS NOT NULL THEN
      RAISE EXCEPTION 'retrieval is not human verification' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_detector_candidate_insert BEFORE INSERT ON af_product_change_candidates FOR EACH ROW EXECUTE FUNCTION af_guard_detector_candidate_insert();
