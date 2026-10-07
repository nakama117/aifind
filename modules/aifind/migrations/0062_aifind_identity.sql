CREATE TABLE af_vendors (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  legal_name text,
  official_url text CHECK (official_url IS NULL OR official_url ~ '^https?://'),
  country_code text CHECK (country_code IN ('JP', 'US')),
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('active', 'inactive', 'unknown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE af_products (
  id text PRIMARY KEY,
  vendor_id text REFERENCES af_vendors(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  canonical_name text NOT NULL CHECK (length(btrim(canonical_name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX af_products_vendor_idx ON af_products(vendor_id);

CREATE TABLE af_product_aliases (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  alias text NOT NULL CHECK (length(alias) BETWEEN 1 AND 200),
  normalized_alias text NOT NULL CHECK (length(btrim(normalized_alias)) > 0),
  locale text,
  alias_type text NOT NULL CHECK (alias_type IN ('official', 'brand', 'former_name', 'common', 'model_family')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, normalized_alias)
);
CREATE INDEX af_product_aliases_lookup_idx ON af_product_aliases(normalized_alias);

CREATE FUNCTION af_keep_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'stable slug cannot change' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_vendor_slug BEFORE UPDATE ON af_vendors FOR EACH ROW EXECUTE FUNCTION af_keep_slug();
CREATE TRIGGER af_product_slug BEFORE UPDATE ON af_products FOR EACH ROW EXECUTE FUNCTION af_keep_slug();
