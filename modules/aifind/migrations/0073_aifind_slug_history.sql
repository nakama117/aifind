CREATE TABLE af_product_slug_redirects (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  old_slug text NOT NULL UNIQUE CHECK (length(old_slug) BETWEEN 1 AND 100 AND old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX af_slug_redirect_product ON af_product_slug_redirects(product_id);

-- A unique index cannot span two tables. All claimants lock the same slug before checking either.
CREATE FUNCTION af_claim_current_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.slug=OLD.slug THEN RETURN NEW; END IF;
  FOR key IN SELECT DISTINCT s FROM unnest(ARRAY[NEW.slug, CASE WHEN TG_OP='UPDATE' THEN OLD.slug ELSE NEW.slug END]) s ORDER BY s LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('af_slug:' || key,0));
  END LOOP;
  IF EXISTS (SELECT 1 FROM af_product_slug_redirects WHERE old_slug=NEW.slug) THEN
    RAISE EXCEPTION 'slug is reserved by public history' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_product_slug_namespace BEFORE INSERT OR UPDATE OF slug ON af_products
FOR EACH ROW EXECUTE FUNCTION af_claim_current_slug();

CREATE FUNCTION af_claim_old_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'slug history is immutable' USING ERRCODE='23514'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('af_slug:' || NEW.old_slug,0));
  IF EXISTS (SELECT 1 FROM af_products WHERE slug=NEW.old_slug) THEN
    RAISE EXCEPTION 'slug is reserved by current identity' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_slug_history_guard BEFORE INSERT OR UPDATE OR DELETE ON af_product_slug_redirects
FOR EACH ROW EXECUTE FUNCTION af_claim_old_slug();

CREATE FUNCTION af_keep_public_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug <> OLD.slug AND OLD.first_public_at IS NOT NULL THEN
    INSERT INTO af_product_slug_redirects(id,product_id,old_slug) VALUES (gen_random_uuid()::text,NEW.id,OLD.slug);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_product_slug_history AFTER UPDATE OF slug ON af_products
FOR EACH ROW EXECUTE FUNCTION af_keep_public_slug();
