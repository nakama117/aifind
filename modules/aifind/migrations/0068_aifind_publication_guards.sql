-- Drafts can hold unverified assertions. Published facts must carry evidence and verification time.
-- Fact-write triggers lock the same version row that this transition updates.
CREATE FUNCTION af_validate_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'published' THEN RETURN NEW; END IF;
  IF NEW.lifecycle_status <> 'unknown' AND (NEW.lifecycle_evidence_id IS NULL OR NEW.lifecycle_verified_at IS NULL) THEN
    RAISE EXCEPTION 'published lifecycle requires evidence and verification' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM af_product_markets WHERE product_version_id=NEW.id AND availability_status <> 'unknown'
    AND (evidence_id IS NULL OR verified_at IS NULL)) THEN
    RAISE EXCEPTION 'published market requires evidence and verification' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM af_product_language_support WHERE product_version_id=NEW.id
    AND (input_support <> 'unknown' OR output_support <> 'unknown' OR ui_support <> 'unknown')
    AND (evidence_id IS NULL OR verified_at IS NULL)) THEN
    RAISE EXCEPTION 'published language requires evidence and verification' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM af_product_platforms WHERE product_version_id=NEW.id AND status <> 'unknown'
    AND (evidence_id IS NULL OR verified_at IS NULL)) THEN
    RAISE EXCEPTION 'published platform requires evidence and verification' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM af_product_capabilities WHERE product_version_id=NEW.id AND support_level <> 'unknown'
    AND (evidence_id IS NULL OR verified_at IS NULL)) THEN
    RAISE EXCEPTION 'published capability requires evidence and verification' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM af_product_plans WHERE product_version_id=NEW.id
    AND (audience <> 'unknown' OR billing_model <> 'unknown' OR active_status <> 'unknown')
    AND (evidence_id IS NULL OR verified_at IS NULL)) THEN
    RAISE EXCEPTION 'published plan requires evidence and verification' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM af_product_prices r JOIN af_product_plans p ON p.id=r.plan_id
    WHERE p.product_version_id=NEW.id AND r.price_type <> 'unknown' AND (r.evidence_id IS NULL OR r.verified_at IS NULL)) THEN
    RAISE EXCEPTION 'published price requires evidence and verification' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_publication_verified BEFORE INSERT OR UPDATE ON af_product_versions
FOR EACH ROW EXECUTE FUNCTION af_validate_publication();
