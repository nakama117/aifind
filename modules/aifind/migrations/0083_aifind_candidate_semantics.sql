-- Independent of immutable proposal_key. Legacy rows remain NULL and are matched by the reader.
ALTER TABLE af_product_change_candidates ADD COLUMN semantic_key text CHECK(semantic_key ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX af_candidate_active_semantic ON af_product_change_candidates(semantic_key)
  WHERE semantic_key IS NOT NULL AND status IN ('detected','pending_review','approved');
CREATE TABLE af_candidate_supporting_evidence (
  candidate_id text NOT NULL REFERENCES af_product_change_candidates(id) ON DELETE RESTRICT,
  evidence_id text NOT NULL REFERENCES af_evidence(id) ON DELETE RESTRICT,
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(candidate_id,evidence_id)
);
INSERT INTO af_candidate_supporting_evidence(candidate_id,evidence_id) SELECT id,evidence_id FROM af_product_change_candidates;
CREATE TRIGGER af_candidate_support_immutable BEFORE UPDATE OR DELETE ON af_candidate_supporting_evidence
  FOR EACH ROW EXECUTE FUNCTION af_keep_evidence();
CREATE FUNCTION af_guard_candidate_support() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM af_product_change_candidates c JOIN af_evidence e ON e.id=NEW.evidence_id
    LEFT JOIN af_source_observations o ON o.id=e.observation_id
    LEFT JOIN af_observation_evidence_context x ON x.evidence_id=e.id
    WHERE c.id=NEW.candidate_id AND (e.id=c.evidence_id OR (x.evidence_id IS NOT NULL
      AND (o.product_id IS NULL OR o.product_id=c.product_id) AND e.content_hash=o.content_hash))) THEN
    RAISE EXCEPTION 'supporting evidence requires matching immutable observation context' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_candidate_support_insert BEFORE INSERT ON af_candidate_supporting_evidence
  FOR EACH ROW EXECUTE FUNCTION af_guard_candidate_support();
