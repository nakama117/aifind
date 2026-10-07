CREATE TABLE af_evidence (
  id text PRIMARY KEY,
  url text NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2000),
  title text CHECK (length(title) <= 500),
  publisher text CHECK (length(publisher) <= 200),
  source_kind text NOT NULL CHECK (source_kind IN ('official_product', 'official_pricing', 'official_docs', 'official_support', 'official_blog', 'official_terms', 'reputable_media', 'other')),
  retrieved_at timestamptz NOT NULL,
  published_at timestamptz,
  content_hash text CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  evidence_note text CHECK (length(evidence_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE af_product_versions ADD COLUMN lifecycle_evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT;
ALTER TABLE af_product_versions ADD COLUMN lifecycle_verified_at timestamptz;

CREATE FUNCTION af_keep_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'evidence is immutable; create a new record' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER af_evidence_immutable BEFORE UPDATE OR DELETE ON af_evidence FOR EACH ROW EXECUTE FUNCTION af_keep_evidence();
