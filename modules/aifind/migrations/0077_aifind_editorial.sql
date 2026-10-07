-- Minimal human Editorial content. Product facts remain in the existing Product Domain.
CREATE TABLE af_editorial_documents (
  id text PRIMARY KEY,
  doc_type text NOT NULL CHECK (doc_type IN ('comparison','category')),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','withdrawn')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
  draft_revision_id text,
  published_revision_id text,
  public_slug text,
  first_published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(doc_type,id),
  CHECK ((state='draft' AND published_revision_id IS NULL AND public_slug IS NULL AND first_published_at IS NULL)
    OR (state IN ('published','withdrawn') AND published_revision_id IS NOT NULL AND public_slug IS NOT NULL AND first_published_at IS NOT NULL))
);
CREATE TABLE af_editorial_revisions (
  id text PRIMARY KEY,
  document_id text NOT NULL REFERENCES af_editorial_documents(id) ON DELETE RESTRICT,
  revision_no integer NOT NULL CHECK (revision_no>0),
  slug text NOT NULL CHECK (length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (length(title)<=200),
  excerpt text NOT NULL DEFAULT '' CHECK (length(excerpt)<=2000),
  body_md text NOT NULL DEFAULT '' CHECK (length(body_md)<=40000),
  seo_title text NOT NULL DEFAULT '' CHECK (length(seo_title)<=200),
  seo_description text NOT NULL DEFAULT '' CHECK (length(seo_description)<=500),
  editor text NOT NULL CHECK (length(btrim(editor)) BETWEEN 1 AND 200),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  published_at timestamptz,
  UNIQUE(document_id,revision_no),
  UNIQUE(document_id,id)
);
ALTER TABLE af_editorial_documents ADD CONSTRAINT af_editorial_draft_owner
  FOREIGN KEY(id,draft_revision_id) REFERENCES af_editorial_revisions(document_id,id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE af_editorial_documents ADD CONSTRAINT af_editorial_published_owner
  FOREIGN KEY(id,published_revision_id) REFERENCES af_editorial_revisions(document_id,id) DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE af_editorial_slug_claims (
  doc_type text NOT NULL,
  slug text NOT NULL CHECK (length(slug) BETWEEN 1 AND 100 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  document_id text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(doc_type,slug),
  FOREIGN KEY(doc_type,document_id) REFERENCES af_editorial_documents(doc_type,id) ON DELETE RESTRICT
);
CREATE TABLE af_comparisons (
  revision_id text PRIMARY KEY REFERENCES af_editorial_revisions(id) ON DELETE RESTRICT,
  mode text NOT NULL DEFAULT 'official_sources' CHECK (mode IN ('official_sources','hands_on')),
  question text NOT NULL DEFAULT '' CHECK (length(question)<=2000),
  purpose text NOT NULL DEFAULT '' CHECK (length(purpose)<=2000),
  methodology_md text NOT NULL DEFAULT '' CHECK (length(methodology_md)<=10000),
  verdict_md text NOT NULL DEFAULT '' CHECK (length(verdict_md)<=10000),
  good_for_md text NOT NULL DEFAULT '' CHECK (length(good_for_md)<=5000),
  not_for_md text NOT NULL DEFAULT '' CHECK (length(not_for_md)<=5000),
  incomparable_conditions_md text NOT NULL DEFAULT '' CHECK (length(incomparable_conditions_md)<=5000),
  limitations_md text NOT NULL DEFAULT '' CHECK (length(limitations_md)<=5000)
);
CREATE TABLE af_comparison_products (
  revision_id text NOT NULL REFERENCES af_comparisons(revision_id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 10),
  reference_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  tested_plan_key text,
  tested_price_ref text REFERENCES af_product_prices(id) ON DELETE RESTRICT,
  PRIMARY KEY(revision_id,product_id), UNIQUE(revision_id,position)
);
CREATE TABLE af_comparison_test_records (
  revision_id text NOT NULL,
  product_id text NOT NULL,
  task text NOT NULL CHECK (length(btrim(task)) BETWEEN 1 AND 2000),
  environment_md text NOT NULL CHECK (length(btrim(environment_md)) BETWEEN 1 AND 5000),
  procedure_md text NOT NULL CHECK (length(btrim(procedure_md)) BETWEEN 1 AND 10000),
  result_md text NOT NULL CHECK (length(btrim(result_md)) BETWEEN 1 AND 10000),
  limitations_md text NOT NULL CHECK (length(btrim(limitations_md)) BETWEEN 1 AND 5000),
  tested_at timestamptz NOT NULL,
  reviewer text NOT NULL CHECK (length(btrim(reviewer)) BETWEEN 1 AND 200),
  repeat_count integer CHECK (repeat_count BETWEEN 1 AND 10000),
  error_criteria text CHECK (error_criteria IS NULL OR length(error_criteria)<=2000),
  PRIMARY KEY(revision_id,product_id),
  FOREIGN KEY(revision_id,product_id) REFERENCES af_comparison_products(revision_id,product_id) ON DELETE RESTRICT
);
CREATE TABLE af_categories (
  revision_id text PRIMARY KEY REFERENCES af_editorial_revisions(id) ON DELETE RESTRICT,
  question text NOT NULL DEFAULT '' CHECK (length(question)<=2000),
  selection_criteria_md text NOT NULL DEFAULT '' CHECK (length(selection_criteria_md)<=10000),
  limitations_md text NOT NULL DEFAULT '' CHECK (length(limitations_md)<=5000)
);
CREATE TABLE af_category_products (
  revision_id text NOT NULL REFERENCES af_categories(revision_id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 10),
  reference_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  fit_summary_ja text NOT NULL DEFAULT '' CHECK (length(fit_summary_ja)<=2000),
  not_for_summary_ja text NOT NULL DEFAULT '' CHECK (length(not_for_summary_ja)<=2000),
  selection_note text NOT NULL DEFAULT '' CHECK (length(selection_note)<=2000),
  PRIMARY KEY(revision_id,product_id), UNIQUE(revision_id,position)
);
CREATE INDEX af_editorial_public ON af_editorial_documents(doc_type,public_slug,id) WHERE state='published';
CREATE INDEX af_compare_product_relations ON af_comparison_products(product_id,revision_id);
CREATE INDEX af_category_product_relations ON af_category_products(product_id,revision_id);

CREATE FUNCTION af_guard_editorial_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE row_data jsonb; r af_editorial_revisions; kind text; v af_product_versions;
BEGIN
  row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_OP='UPDATE' AND ((to_jsonb(OLD)->>'revision_id') IS DISTINCT FROM (row_data->>'revision_id')
    OR (to_jsonb(OLD)->>'product_id') IS DISTINCT FROM (row_data->>'product_id')) THEN
    RAISE EXCEPTION 'editorial relation ownership is immutable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO r FROM af_editorial_revisions WHERE id=row_data->>'revision_id' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'editorial revision missing' USING ERRCODE='23503'; END IF;
  SELECT doc_type INTO kind FROM af_editorial_documents WHERE id=r.document_id;
  IF (TG_TABLE_NAME IN ('af_categories','af_category_products') AND kind<>'category')
    OR (TG_TABLE_NAME NOT IN ('af_categories','af_category_products') AND kind<>'comparison') THEN
    RAISE EXCEPTION 'wrong editorial subtype' USING ERRCODE='23514';
  END IF;
  IF r.published_at IS NOT NULL THEN RAISE EXCEPTION 'published editorial content is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME IN ('af_comparison_products','af_category_products') THEN
    SELECT * INTO v FROM af_product_versions WHERE id=row_data->>'reference_version_id';
    IF NOT FOUND OR v.product_id<>row_data->>'product_id' OR v.published_at IS NULL OR v.status='draft' THEN
      RAISE EXCEPTION 'reference must be a previously Published version of this Product' USING ERRCODE='23514';
    END IF;
    IF TG_TABLE_NAME='af_comparison_products' THEN
      IF NEW.tested_plan_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM af_product_plans WHERE product_version_id=v.id AND plan_key=NEW.tested_plan_key) THEN
        RAISE EXCEPTION 'tested plan does not belong to reference version' USING ERRCODE='23514';
      END IF;
      IF NEW.tested_price_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM af_product_prices p JOIN af_product_plans l ON l.id=p.plan_id
        WHERE p.id=NEW.tested_price_ref AND l.product_version_id=v.id AND (NEW.tested_plan_key IS NULL OR l.plan_key=NEW.tested_plan_key)) THEN
        RAISE EXCEPTION 'tested price does not belong to reference plan/version' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_compare_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON af_comparisons FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_child();
CREATE TRIGGER af_compare_products_guard BEFORE INSERT OR UPDATE OR DELETE ON af_comparison_products FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_child();
CREATE TRIGGER af_compare_records_guard BEFORE INSERT OR UPDATE OR DELETE ON af_comparison_test_records FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_child();
CREATE TRIGGER af_category_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON af_categories FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_child();
CREATE TRIGGER af_category_products_guard BEFORE INSERT OR UPDATE OR DELETE ON af_category_products FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_child();

CREATE FUNCTION af_guard_editorial_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE kind text; n integer;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'editorial revision history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF NEW.id<>OLD.id OR NEW.document_id<>OLD.document_id OR NEW.revision_no<>OLD.revision_no OR NEW.created_at<>OLD.created_at THEN
    RAISE EXCEPTION 'editorial revision identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'published editorial revision is immutable' USING ERRCODE='23514'; END IF;
  IF NEW.published_at IS NOT NULL THEN
    IF length(btrim(NEW.title))=0 OR length(btrim(NEW.excerpt))=0 OR length(btrim(NEW.body_md))=0 THEN
      RAISE EXCEPTION 'editorial title, excerpt and body required' USING ERRCODE='23514';
    END IF;
    SELECT doc_type INTO kind FROM af_editorial_documents WHERE id=NEW.document_id;
    IF kind='comparison' THEN
      SELECT count(*) INTO n FROM af_comparison_products WHERE revision_id=NEW.id;
      IF n NOT BETWEEN 2 AND 3 OR NOT EXISTS (SELECT 1 FROM af_comparisons WHERE revision_id=NEW.id
        AND length(btrim(question))>0 AND length(btrim(purpose))>0 AND length(btrim(methodology_md))>0
        AND length(btrim(verdict_md))>0 AND length(btrim(good_for_md))>0 AND length(btrim(not_for_md))>0
        AND length(btrim(incomparable_conditions_md))>0 AND length(btrim(limitations_md))>0) THEN
        RAISE EXCEPTION 'comparison is incomplete' USING ERRCODE='23514';
      END IF;
      IF EXISTS (SELECT 1 FROM af_comparisons c JOIN af_comparison_products p ON p.revision_id=c.revision_id
        WHERE c.revision_id=NEW.id AND c.mode='hands_on' AND NOT EXISTS(SELECT 1 FROM af_comparison_test_records t WHERE t.revision_id=p.revision_id AND t.product_id=p.product_id)) THEN
        RAISE EXCEPTION 'hands_on requires a Test Record per Product' USING ERRCODE='23514';
      END IF;
    ELSE
      SELECT count(*) INTO n FROM af_category_products WHERE revision_id=NEW.id;
      IF n NOT BETWEEN 3 AND 5 OR NOT EXISTS (SELECT 1 FROM af_categories WHERE revision_id=NEW.id
        AND length(btrim(question))>0 AND length(btrim(selection_criteria_md))>0 AND length(btrim(limitations_md))>0)
        OR EXISTS(SELECT 1 FROM af_category_products WHERE revision_id=NEW.id
          AND (length(btrim(fit_summary_ja))=0 OR length(btrim(not_for_summary_ja))=0 OR length(btrim(selection_note))=0)) THEN
        RAISE EXCEPTION 'curated category is incomplete' USING ERRCODE='23514';
      END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM (SELECT product_id FROM af_comparison_products WHERE revision_id=NEW.id
      UNION ALL SELECT product_id FROM af_category_products WHERE revision_id=NEW.id) rel
      WHERE NOT EXISTS(SELECT 1 FROM af_products p JOIN af_product_versions v ON v.product_id=p.id
        WHERE p.id=rel.product_id AND p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v))) THEN
      RAISE EXCEPTION 'every required Product must be listed Published and public-ready' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_editorial_revision_guard BEFORE UPDATE OR DELETE ON af_editorial_revisions FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_revision();

CREATE FUNCTION af_guard_editorial_document() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r af_editorial_revisions;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'editorial history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.doc_type<>OLD.doc_type OR NEW.created_at<>OLD.created_at
    OR (OLD.first_published_at IS NOT NULL AND NEW.first_published_at IS DISTINCT FROM OLD.first_published_at)) THEN
    RAISE EXCEPTION 'editorial identity and first publication are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.draft_revision_id IS NOT NULL THEN
    SELECT * INTO r FROM af_editorial_revisions WHERE id=NEW.draft_revision_id AND document_id=NEW.id;
    IF NOT FOUND OR r.published_at IS NOT NULL THEN RAISE EXCEPTION 'invalid Draft pointer' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.published_revision_id IS NOT NULL THEN
    SELECT * INTO r FROM af_editorial_revisions WHERE id=NEW.published_revision_id AND document_id=NEW.id;
    IF NOT FOUND OR r.published_at IS NULL OR NEW.public_slug<>r.slug OR NOT EXISTS (SELECT 1 FROM af_editorial_slug_claims
      WHERE doc_type=NEW.doc_type AND slug=r.slug AND document_id=NEW.id) THEN
      RAISE EXCEPTION 'invalid Published pointer or slug claim' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_editorial_document_guard BEFORE UPDATE OR DELETE ON af_editorial_documents FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_document();
CREATE FUNCTION af_guard_editorial_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'published slug claims are permanent' USING ERRCODE='23514'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'slug claims require Read Committed' USING ERRCODE='25000'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_editorial_claim_guard BEFORE INSERT OR UPDATE OR DELETE ON af_editorial_slug_claims FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_claim();
