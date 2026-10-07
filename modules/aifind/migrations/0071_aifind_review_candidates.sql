CREATE TABLE af_product_change_candidates (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  base_version_id text NOT NULL,
  candidate_type text NOT NULL CHECK(candidate_type IN ('market','language','platform','capability','plan','price','lifecycle')),
  target_key text NOT NULL CHECK(length(target_key) BETWEEN 1 AND 100),
  target_ref text REFERENCES af_product_prices(id) ON DELETE RESTRICT,
  proposed_value jsonb NOT NULL CHECK(jsonb_typeof(proposed_value)='object'),
  evidence_id text NOT NULL REFERENCES af_evidence(id) ON DELETE RESTRICT,
  source_type text NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual','detector','import')),
  status text NOT NULL DEFAULT 'pending_review' CHECK(status IN ('detected','pending_review','approved','rejected','applied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_reason text,
  applied_at timestamptz,
  applied_version_id text,
  FOREIGN KEY(base_version_id, product_id) REFERENCES af_product_versions(id, product_id) ON DELETE RESTRICT,
  FOREIGN KEY(applied_version_id, product_id) REFERENCES af_product_versions(id, product_id) ON DELETE RESTRICT,
  CHECK(target_ref IS NULL OR candidate_type='price'),
  CHECK((status IN ('detected','pending_review') AND reviewed_at IS NULL AND reviewed_by IS NULL AND applied_at IS NULL AND applied_version_id IS NULL)
    OR (status IN ('approved','rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND review_reason IS NOT NULL AND length(btrim(review_reason))>0 AND applied_at IS NULL AND applied_version_id IS NULL)
    OR (status='applied' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND review_reason IS NOT NULL AND length(btrim(review_reason))>0 AND applied_at IS NOT NULL AND applied_version_id IS NOT NULL))
);
CREATE INDEX af_candidates_queue ON af_product_change_candidates(status, created_at DESC, id);
CREATE INDEX af_candidates_product ON af_product_change_candidates(product_id, status);

CREATE FUNCTION af_guard_candidate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'candidate history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW)-'status'-'reviewed_at'-'reviewed_by'-'review_reason'-'applied_at'-'applied_version_id') IS DISTINCT FROM
     (to_jsonb(OLD)-'status'-'reviewed_at'-'reviewed_by'-'review_reason'-'applied_at'-'applied_version_id') THEN
    RAISE EXCEPTION 'candidate proposal is immutable' USING ERRCODE='23514';
  END IF;
  IF NOT ((OLD.status='detected' AND NEW.status='pending_review')
    OR (OLD.status='pending_review' AND NEW.status IN ('approved','rejected'))
    OR (OLD.status='approved' AND NEW.status='applied')) THEN
    RAISE EXCEPTION 'invalid candidate transition' USING ERRCODE='23514';
  END IF;
  IF NEW.status='applied' AND (NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
    OR NEW.review_reason IS DISTINCT FROM OLD.review_reason) THEN
    RAISE EXCEPTION 'candidate review is immutable after approval' USING ERRCODE='23514';
  END IF;
  IF NEW.status='applied' AND NOT EXISTS (SELECT 1 FROM af_product_versions WHERE id=NEW.applied_version_id AND status='draft') THEN
    RAISE EXCEPTION 'candidate applies only to Draft' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_candidate_state BEFORE UPDATE OR DELETE ON af_product_change_candidates FOR EACH ROW EXECUTE FUNCTION af_guard_candidate();
