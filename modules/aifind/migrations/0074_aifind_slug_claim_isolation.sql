-- A pre-existing Repeatable Read snapshot cannot see claims committed after it began,
-- even after taking 0073's advisory lock. Writes need RC; public reads remain RR.
CREATE FUNCTION af_require_slug_claim_isolation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='af_products' THEN
    IF TG_OP='UPDATE' AND NEW.slug=OLD.slug THEN RETURN NEW; END IF;
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'slug claims require read committed isolation' USING ERRCODE='25000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_product_slug_claim_isolation BEFORE INSERT OR UPDATE OF slug ON af_products
FOR EACH ROW EXECUTE FUNCTION af_require_slug_claim_isolation();
CREATE TRIGGER af_slug_claim_isolation BEFORE INSERT ON af_product_slug_redirects
FOR EACH ROW EXECUTE FUNCTION af_require_slug_claim_isolation();
