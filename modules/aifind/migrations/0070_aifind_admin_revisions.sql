-- Admin tokens include writes through the original Catalog and Preview, not only the new UI.
ALTER TABLE af_product_versions ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991);
ALTER TABLE af_product_versions ADD CONSTRAINT af_version_product_pair UNIQUE(id, product_id);
ALTER TABLE af_product_versions ADD COLUMN base_version_id text;
ALTER TABLE af_product_versions ADD CONSTRAINT af_version_base_product_fk
  FOREIGN KEY(base_version_id, product_id) REFERENCES af_product_versions(id, product_id) ON DELETE RESTRICT;

-- Pre-existing drafts predate lineage. Their current Published is a conservative base;
-- application also compares the actual target value and refuses incompatible edits.
UPDATE af_product_versions d SET base_version_id=p.id FROM af_product_versions p
WHERE d.product_id=p.product_id AND d.status='draft' AND p.status='published';

ALTER TABLE af_product_prices ADD COLUMN base_price_id text REFERENCES af_product_prices(id) ON DELETE RESTRICT;
UPDATE af_product_prices d SET base_price_id=(
  SELECT min(b.id) FROM af_product_prices b JOIN af_product_plans bp ON bp.id=b.plan_id
  WHERE bp.product_version_id=dv.base_version_id AND bp.plan_key=dp.plan_key
    AND (to_jsonb(b)-'id'-'plan_id'-'base_price_id')=(to_jsonb(d)-'id'-'plan_id'-'base_price_id')
  HAVING count(*)=1
) FROM af_product_plans dp JOIN af_product_versions dv ON dv.id=dp.product_version_id
WHERE d.plan_id=dp.id AND dv.status='draft';

CREATE FUNCTION af_admin_version_token() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.base_version_id IS DISTINCT FROM OLD.base_version_id THEN
    RAISE EXCEPTION 'draft base version is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status='draft' AND NEW.status='draft' THEN NEW.revision:=OLD.revision+1;
  ELSIF NEW.revision IS DISTINCT FROM OLD.revision THEN
    RAISE EXCEPTION 'published revision token is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_version_admin_token BEFORE UPDATE ON af_product_versions
FOR EACH ROW EXECUTE FUNCTION af_admin_version_token();

CREATE FUNCTION af_advance_draft_token() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE version_id text; row_data jsonb;
BEGIN
  row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_TABLE_NAME='af_product_prices' THEN
    SELECT product_version_id INTO version_id FROM af_product_plans WHERE id=row_data->>'plan_id';
  ELSE version_id:=row_data->>'product_version_id'; END IF;
  UPDATE af_product_versions SET revision=revision WHERE id=version_id AND status='draft';
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_market_token AFTER INSERT OR UPDATE OR DELETE ON af_product_markets FOR EACH ROW EXECUTE FUNCTION af_advance_draft_token();
CREATE TRIGGER af_language_token AFTER INSERT OR UPDATE OR DELETE ON af_product_language_support FOR EACH ROW EXECUTE FUNCTION af_advance_draft_token();
CREATE TRIGGER af_platform_token AFTER INSERT OR UPDATE OR DELETE ON af_product_platforms FOR EACH ROW EXECUTE FUNCTION af_advance_draft_token();
CREATE TRIGGER af_capability_token AFTER INSERT OR UPDATE OR DELETE ON af_product_capabilities FOR EACH ROW EXECUTE FUNCTION af_advance_draft_token();
CREATE TRIGGER af_plan_token AFTER INSERT OR UPDATE OR DELETE ON af_product_plans FOR EACH ROW EXECUTE FUNCTION af_advance_draft_token();
CREATE TRIGGER af_price_token AFTER INSERT OR UPDATE OR DELETE ON af_product_prices FOR EACH ROW EXECUTE FUNCTION af_advance_draft_token();

CREATE FUNCTION af_guard_price_base() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.base_price_id IS DISTINCT FROM OLD.base_price_id THEN
    RAISE EXCEPTION 'price clone lineage is immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.base_price_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM af_product_prices b JOIN af_product_plans bp ON bp.id=b.plan_id
    JOIN af_product_plans dp ON dp.id=NEW.plan_id JOIN af_product_versions dv ON dv.id=dp.product_version_id
    WHERE b.id=NEW.base_price_id AND bp.product_version_id=dv.base_version_id AND bp.plan_key=dp.plan_key
  ) THEN RAISE EXCEPTION 'price base does not belong to draft lineage' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_price_base BEFORE INSERT OR UPDATE ON af_product_prices FOR EACH ROW EXECUTE FUNCTION af_guard_price_base();

ALTER TABLE af_products ADD COLUMN identity_revision bigint NOT NULL DEFAULT 1 CHECK (identity_revision BETWEEN 1 AND 9007199254740991);
CREATE FUNCTION af_admin_identity_token() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.identity_revision:=OLD.identity_revision+1; RETURN NEW; END;
$$;
CREATE TRIGGER af_identity_admin_token BEFORE UPDATE ON af_products FOR EACH ROW EXECUTE FUNCTION af_admin_identity_token();

-- Phase 2 explicitly permits Product URL identity edits; Vendor slugs and ordinary SQL stay stable.
CREATE OR REPLACE FUNCTION af_keep_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug AND NOT (
    TG_TABLE_NAME='af_products' AND coalesce(current_setting('aifind.identity_product', true),'')=OLD.id
  ) THEN RAISE EXCEPTION 'stable slug cannot change outside explicit identity edit' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
