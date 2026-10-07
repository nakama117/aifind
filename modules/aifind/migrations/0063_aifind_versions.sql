CREATE TABLE af_product_versions (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  version_no integer NOT NULL CHECK (version_no > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
  official_url text CHECK (official_url IS NULL OR official_url ~ '^https?://'),
  lifecycle_status text NOT NULL DEFAULT 'unknown' CHECK (lifecycle_status IN ('unknown', 'active', 'beta', 'waitlist', 'discontinued', 'acquired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  published_at timestamptz,
  superseded_at timestamptz,
  UNIQUE(product_id, version_no),
  CHECK ((status='draft' AND published_at IS NULL AND superseded_at IS NULL)
    OR (status='published' AND published_at IS NOT NULL AND superseded_at IS NULL)
    OR (status='superseded' AND published_at IS NOT NULL AND superseded_at IS NOT NULL))
);
CREATE UNIQUE INDEX af_product_one_draft ON af_product_versions(product_id) WHERE status='draft';
CREATE UNIQUE INDEX af_product_one_published ON af_product_versions(product_id) WHERE status='published';

CREATE FUNCTION af_guard_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'published history is immutable' USING ERRCODE='23514'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.version_no IS DISTINCT FROM OLD.version_no THEN
    RAISE EXCEPTION 'version identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.status <> 'draft' THEN
    IF NOT (OLD.status='published' AND NEW.status='superseded'
      AND (to_jsonb(NEW) - 'status' - 'superseded_at') = (to_jsonb(OLD) - 'status' - 'superseded_at')) THEN
      RAISE EXCEPTION 'published history is immutable' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'invalid version transition' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_version_immutable BEFORE UPDATE OR DELETE ON af_product_versions FOR EACH ROW EXECUTE FUNCTION af_guard_version();

-- Each future fact table locks its version before writing; ownership cannot be reassigned.
CREATE FUNCTION af_guard_draft_fact() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb; version_id text; version_status text;
BEGIN
  row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  version_id := row_data->>'product_version_id';
  IF TG_OP='UPDATE' AND (to_jsonb(OLD)->>'product_version_id') IS DISTINCT FROM version_id THEN
    RAISE EXCEPTION 'fact ownership is immutable' USING ERRCODE='23514';
  END IF;
  SELECT status INTO version_status FROM af_product_versions WHERE id=version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'version not found' USING ERRCODE='23503'; END IF;
  IF version_status <> 'draft' THEN RAISE EXCEPTION 'published facts are immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
