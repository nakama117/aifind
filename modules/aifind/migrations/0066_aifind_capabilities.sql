CREATE TABLE af_product_capabilities (
  product_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  capability_key text NOT NULL CHECK (capability_key IN ('text', 'image_generation', 'image_understanding', 'video_generation', 'audio', 'coding', 'search', 'research', 'agent', 'api')),
  support_level text NOT NULL DEFAULT 'unknown' CHECK (support_level IN ('unknown', 'none', 'partial', 'full')),
  verified_at timestamptz,
  evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY(product_version_id, capability_key)
);
CREATE TRIGGER af_capability_draft BEFORE INSERT OR UPDATE OR DELETE ON af_product_capabilities FOR EACH ROW EXECUTE FUNCTION af_guard_draft_fact();
