CREATE TABLE af_product_markets (
  id text PRIMARY KEY,
  product_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  market_code text NOT NULL CHECK (market_code IN ('JP', 'US')),
  availability_status text NOT NULL DEFAULT 'unknown' CHECK (availability_status IN ('unknown', 'available', 'unavailable', 'waitlist', 'restricted')),
  verified_at timestamptz,
  evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT,
  UNIQUE(product_version_id, market_code)
);
CREATE TABLE af_product_language_support (
  product_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  language_code text NOT NULL CHECK (language_code IN ('ja', 'en')),
  input_support text NOT NULL DEFAULT 'unknown' CHECK (input_support IN ('unknown', 'none', 'partial', 'full')),
  output_support text NOT NULL DEFAULT 'unknown' CHECK (output_support IN ('unknown', 'none', 'partial', 'full')),
  ui_support text NOT NULL DEFAULT 'unknown' CHECK (ui_support IN ('unknown', 'none', 'partial', 'full')),
  verified_at timestamptz,
  evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY(product_version_id, language_code)
);
CREATE TABLE af_product_platforms (
  product_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  platform_key text NOT NULL CHECK (platform_key IN ('web', 'ios', 'android', 'windows', 'macos', 'linux', 'browser_extension')),
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('unknown', 'available', 'unavailable')),
  verified_at timestamptz,
  evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT,
  PRIMARY KEY(product_version_id, platform_key)
);
CREATE TRIGGER af_market_draft BEFORE INSERT OR UPDATE OR DELETE ON af_product_markets FOR EACH ROW EXECUTE FUNCTION af_guard_draft_fact();
CREATE TRIGGER af_language_draft BEFORE INSERT OR UPDATE OR DELETE ON af_product_language_support FOR EACH ROW EXECUTE FUNCTION af_guard_draft_fact();
CREATE TRIGGER af_platform_draft BEFORE INSERT OR UPDATE OR DELETE ON af_product_platforms FOR EACH ROW EXECUTE FUNCTION af_guard_draft_fact();
