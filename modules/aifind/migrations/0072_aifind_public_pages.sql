ALTER TABLE af_products ADD COLUMN public_visibility text NOT NULL DEFAULT 'private'
  CHECK (public_visibility IN ('private','unlisted','listed'));
ALTER TABLE af_products ADD COLUMN first_public_at timestamptz;
ALTER TABLE af_product_versions ADD COLUMN summary_ja text
  CHECK (summary_ja IS NULL OR length(btrim(summary_ja)) BETWEEN 1 AND 2000);

-- Public readiness is stricter than private domain publication. Unknown actual JP/ja rows are valid.
CREATE FUNCTION af_public_version_ready(v af_product_versions) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT length(btrim(v.display_name)) > 0 AND v.official_url ~ '^https?://[^/[:space:]]+'
    AND v.summary_ja IS NOT NULL AND length(btrim(v.summary_ja)) > 0
    AND EXISTS (SELECT 1 FROM af_product_markets WHERE product_version_id=v.id AND market_code='JP')
    AND EXISTS (SELECT 1 FROM af_product_language_support WHERE product_version_id=v.id AND language_code='ja')
    AND EXISTS (
      SELECT 1 FROM (
        SELECT v.lifecycle_evidence_id AS evidence_id, v.lifecycle_verified_at AS verified_at WHERE v.lifecycle_status <> 'unknown'
        UNION ALL SELECT evidence_id,verified_at FROM af_product_markets WHERE product_version_id=v.id AND availability_status <> 'unknown'
        UNION ALL SELECT evidence_id,verified_at FROM af_product_language_support WHERE product_version_id=v.id
          AND (input_support <> 'unknown' OR output_support <> 'unknown' OR ui_support <> 'unknown')
        UNION ALL SELECT evidence_id,verified_at FROM af_product_platforms WHERE product_version_id=v.id AND status <> 'unknown'
        UNION ALL SELECT evidence_id,verified_at FROM af_product_capabilities WHERE product_version_id=v.id AND support_level <> 'unknown'
        UNION ALL SELECT evidence_id,verified_at FROM af_product_plans WHERE product_version_id=v.id
          AND (audience <> 'unknown' OR billing_model <> 'unknown' OR active_status <> 'unknown')
        UNION ALL SELECT r.evidence_id,r.verified_at FROM af_product_prices r JOIN af_product_plans p ON p.id=r.plan_id
          WHERE p.product_version_id=v.id AND r.price_type <> 'unknown'
      ) f JOIN af_evidence e ON e.id=f.evidence_id WHERE f.verified_at IS NOT NULL
    )
    AND NOT EXISTS (SELECT 1 FROM af_product_prices r JOIN af_product_plans p ON p.id=r.plan_id
      WHERE p.product_version_id=v.id AND r.price_type IN ('fixed','from') AND r.billing_period='none');
$$;
CREATE FUNCTION af_guard_public_visibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v af_product_versions;
BEGIN
  IF TG_OP='UPDATE' AND OLD.first_public_at IS NOT NULL AND NEW.first_public_at IS DISTINCT FROM OLD.first_public_at THEN
    RAISE EXCEPTION 'first_public_at is permanent' USING ERRCODE='23514';
  END IF;
  IF NEW.public_visibility <> 'private' THEN
    SELECT * INTO v FROM af_product_versions WHERE product_id=NEW.id AND status='published';
    IF NOT FOUND OR af_public_version_ready(v) IS NOT TRUE THEN
      RAISE EXCEPTION 'public product is not ready' USING ERRCODE='23514';
    END IF;
    IF NEW.first_public_at IS NULL THEN NEW.first_public_at := clock_timestamp(); END IF;
  ELSIF TG_OP='INSERT' AND NEW.first_public_at IS NOT NULL THEN
    RAISE EXCEPTION 'private product cannot invent first_public_at' USING ERRCODE='23514';
  ELSIF TG_OP='UPDATE' AND OLD.first_public_at IS NULL AND NEW.first_public_at IS NOT NULL THEN
    RAISE EXCEPTION 'private product cannot invent first_public_at' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_product_public_visibility BEFORE INSERT OR UPDATE ON af_products
FOR EACH ROW EXECUTE FUNCTION af_guard_public_visibility();
CREATE FUNCTION af_guard_public_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='published' AND EXISTS (SELECT 1 FROM af_products WHERE id=NEW.product_id AND public_visibility <> 'private')
    AND af_public_version_ready(NEW) IS NOT TRUE THEN
    RAISE EXCEPTION 'public replacement version is not ready' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_public_page_version BEFORE INSERT OR UPDATE ON af_product_versions
FOR EACH ROW EXECUTE FUNCTION af_guard_public_version();
