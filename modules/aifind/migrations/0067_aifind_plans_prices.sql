CREATE TABLE af_product_plans (
  id text PRIMARY KEY,
  product_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  plan_key text NOT NULL CHECK (length(plan_key) BETWEEN 1 AND 100 AND plan_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  audience text NOT NULL DEFAULT 'unknown' CHECK (audience IN ('free', 'personal', 'team', 'business', 'enterprise', 'developer', 'unknown')),
  billing_model text NOT NULL DEFAULT 'unknown' CHECK (billing_model IN ('free', 'subscription', 'usage', 'custom', 'unknown')),
  active_status text NOT NULL DEFAULT 'unknown' CHECK (active_status IN ('unknown', 'active', 'inactive')),
  verified_at timestamptz,
  evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT,
  UNIQUE(product_version_id, plan_key)
);
CREATE TRIGGER af_plan_draft BEFORE INSERT OR UPDATE OR DELETE ON af_product_plans FOR EACH ROW EXECUTE FUNCTION af_guard_draft_fact();

CREATE TABLE af_product_prices (
  id text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES af_product_plans(id) ON DELETE RESTRICT,
  market_code text CHECK (market_code IN ('JP', 'US')),
  currency_code text CHECK (currency_code IN ('JPY', 'USD', 'EUR', 'GBP')),
  billing_period text NOT NULL CHECK (billing_period IN ('month', 'year', 'usage', 'one_time', 'custom', 'none')),
  price_type text NOT NULL CHECK (price_type IN ('free', 'fixed', 'from', 'custom', 'unknown')),
  amount_minor bigint CHECK (amount_minor BETWEEN 0 AND 9007199254740991),
  unit_label text CHECK (length(unit_label) <= 200),
  valid_from date,
  valid_to date,
  verified_at timestamptz,
  evidence_id text REFERENCES af_evidence(id) ON DELETE RESTRICT,
  CHECK ((price_type='free' AND amount_minor IS NOT NULL AND amount_minor=0)
    OR (price_type IN ('unknown', 'custom') AND amount_minor IS NULL)
    OR (price_type IN ('fixed', 'from') AND currency_code IS NOT NULL AND amount_minor IS NOT NULL AND amount_minor > 0)),
  CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX af_product_prices_plan_idx ON af_product_prices(plan_id);

CREATE FUNCTION af_guard_draft_price() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb; version_id text; version_status text;
BEGIN
  row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_OP='UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'price ownership is immutable' USING ERRCODE='23514';
  END IF;
  SELECT product_version_id INTO version_id FROM af_product_plans WHERE id=row_data->>'plan_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'plan not found' USING ERRCODE='23503'; END IF;
  SELECT status INTO version_status FROM af_product_versions WHERE id=version_id FOR UPDATE;
  IF version_status <> 'draft' THEN RAISE EXCEPTION 'published facts are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_price_draft BEFORE INSERT OR UPDATE OR DELETE ON af_product_prices FOR EACH ROW EXECUTE FUNCTION af_guard_draft_price();
