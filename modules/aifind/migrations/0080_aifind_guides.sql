-- Guide extends the existing Editorial revision; Product facts stay in Product Domain.
ALTER TABLE af_editorial_documents DROP CONSTRAINT af_editorial_documents_doc_type_check;
ALTER TABLE af_editorial_documents ADD CONSTRAINT af_editorial_documents_doc_type_check CHECK(doc_type IN ('comparison','category','guide'));
CREATE TABLE af_guides (
  revision_id text PRIMARY KEY REFERENCES af_editorial_revisions(id) ON DELETE RESTRICT,
  mode text NOT NULL CHECK(mode IN ('official_sources','hands_on')),
  task text NOT NULL DEFAULT '' CHECK(length(task)<=2000),
  task_result_md text NOT NULL DEFAULT '' CHECK(length(task_result_md)<=10000),
  prerequisites_md text NOT NULL DEFAULT '' CHECK(length(prerequisites_md)<=5000),
  materials_md text NOT NULL DEFAULT '' CHECK(length(materials_md)<=10000),
  steps_md text NOT NULL DEFAULT '' CHECK(length(steps_md)<=20000),
  result_md text NOT NULL DEFAULT '' CHECK(length(result_md)<=10000),
  failures_md text NOT NULL DEFAULT '' CHECK(length(failures_md)<=10000),
  limitations_md text NOT NULL DEFAULT '' CHECK(length(limitations_md)<=5000),
  cost_notes_md text NOT NULL DEFAULT '' CHECK(length(cost_notes_md)<=5000),
  alternatives_md text NOT NULL DEFAULT '' CHECK(length(alternatives_md)<=5000)
);
CREATE TABLE af_guide_products (
  revision_id text NOT NULL REFERENCES af_guides(revision_id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES af_products(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK(position BETWEEN 1 AND 3),
  role text NOT NULL CHECK(role IN ('primary','alternative','prerequisite')),
  reference_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  referenced_plan_key text,
  referenced_price_ref text REFERENCES af_product_prices(id) ON DELETE RESTRICT,
  PRIMARY KEY(revision_id,product_id), UNIQUE(revision_id,position)
);
CREATE TABLE af_guide_test_records (
  revision_id text NOT NULL,
  product_id text NOT NULL,
  reference_version_id text NOT NULL REFERENCES af_product_versions(id) ON DELETE RESTRICT,
  referenced_plan_key text,
  task text NOT NULL CHECK(length(btrim(task)) BETWEEN 1 AND 2000),
  environment_md text NOT NULL CHECK(length(btrim(environment_md)) BETWEEN 1 AND 5000),
  procedure_md text NOT NULL CHECK(length(btrim(procedure_md)) BETWEEN 1 AND 10000),
  result_md text NOT NULL CHECK(length(btrim(result_md)) BETWEEN 1 AND 10000),
  limitations_md text NOT NULL CHECK(length(btrim(limitations_md)) BETWEEN 1 AND 5000),
  tested_at timestamptz NOT NULL,
  reviewer text NOT NULL CHECK(length(btrim(reviewer)) BETWEEN 1 AND 200),
  repeat_count integer CHECK(repeat_count BETWEEN 1 AND 10000),
  error_criteria text CHECK(error_criteria IS NULL OR length(error_criteria)<=2000),
  PRIMARY KEY(revision_id,product_id),
  FOREIGN KEY(revision_id,product_id) REFERENCES af_guide_products(revision_id,product_id) ON DELETE RESTRICT
);
CREATE INDEX af_guide_product_relations ON af_guide_products(product_id,revision_id);
CREATE FUNCTION af_guard_guide_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE data jsonb; r af_editorial_revisions; v af_product_versions; p af_guide_products;
BEGIN
  data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  IF TG_OP='UPDATE' AND ((to_jsonb(OLD)->>'revision_id') IS DISTINCT FROM data->>'revision_id'
    OR (to_jsonb(OLD)->>'product_id') IS DISTINCT FROM data->>'product_id') THEN
    RAISE EXCEPTION 'Guide relation ownership is immutable' USING ERRCODE='23514';
  END IF;
  SELECT * INTO r FROM af_editorial_revisions WHERE id=data->>'revision_id' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guide revision missing' USING ERRCODE='23503'; END IF;
  IF (SELECT doc_type FROM af_editorial_documents WHERE id=r.document_id)<>'guide' THEN RAISE EXCEPTION 'wrong Guide subtype' USING ERRCODE='23514'; END IF;
  IF r.published_at IS NOT NULL THEN RAISE EXCEPTION 'published Guide content is immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_TABLE_NAME='af_guide_products' THEN
    IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM af_guide_test_records t WHERE t.revision_id=NEW.revision_id AND t.product_id=NEW.product_id
      AND (t.reference_version_id<>NEW.reference_version_id OR t.referenced_plan_key IS DISTINCT FROM NEW.referenced_plan_key)) THEN
      RAISE EXCEPTION 'remove old Test Record before changing its reference binding' USING ERRCODE='23514';
    END IF;
    SELECT * INTO v FROM af_product_versions WHERE id=NEW.reference_version_id;
    IF NOT FOUND OR v.product_id<>NEW.product_id OR v.published_at IS NULL OR v.status='draft' THEN
      RAISE EXCEPTION 'reference must be a previously Published version of this Product' USING ERRCODE='23514';
    END IF;
    IF NEW.referenced_plan_key IS NOT NULL AND NOT EXISTS(SELECT 1 FROM af_product_plans WHERE product_version_id=v.id AND plan_key=NEW.referenced_plan_key) THEN
      RAISE EXCEPTION 'referenced Plan does not belong to reference version' USING ERRCODE='23514';
    END IF;
    IF NEW.referenced_price_ref IS NOT NULL AND NOT EXISTS(SELECT 1 FROM af_product_prices s JOIN af_product_plans l ON l.id=s.plan_id
      WHERE s.id=NEW.referenced_price_ref AND l.product_version_id=v.id AND (NEW.referenced_plan_key IS NULL OR l.plan_key=NEW.referenced_plan_key)) THEN
      RAISE EXCEPTION 'referenced Price does not belong to Plan/version' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='af_guide_test_records' THEN
    SELECT * INTO p FROM af_guide_products WHERE revision_id=NEW.revision_id AND product_id=NEW.product_id;
    IF NOT FOUND OR p.reference_version_id<>NEW.reference_version_id OR p.referenced_plan_key IS DISTINCT FROM NEW.referenced_plan_key THEN
      RAISE EXCEPTION 'Guide Test Record binding mismatch' USING ERRCODE='23514';
    END IF;
    IF EXISTS(SELECT 1 FROM af_guide_test_records t JOIN af_editorial_revisions x ON x.id=t.revision_id
      WHERE x.document_id=r.document_id AND t.product_id=NEW.product_id AND t.tested_at=NEW.tested_at
        AND (t.reference_version_id<>NEW.reference_version_id OR t.referenced_plan_key IS DISTINCT FROM NEW.referenced_plan_key)) THEN
      RAISE EXCEPTION 'changed reference requires a new Test Record, not relabelled old testedAt' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_guide_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON af_guides FOR EACH ROW EXECUTE FUNCTION af_guard_guide_child();
CREATE TRIGGER af_guide_products_guard BEFORE INSERT OR UPDATE OR DELETE ON af_guide_products FOR EACH ROW EXECUTE FUNCTION af_guard_guide_child();
CREATE TRIGGER af_guide_records_guard BEFORE INSERT OR UPDATE OR DELETE ON af_guide_test_records FOR EACH ROW EXECUTE FUNCTION af_guard_guide_child();

CREATE OR REPLACE FUNCTION af_guard_editorial_revision() RETURNS trigger LANGUAGE plpgsql AS $$
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
    ELSIF kind='category' THEN
      SELECT count(*) INTO n FROM af_category_products WHERE revision_id=NEW.id;
      IF n NOT BETWEEN 3 AND 5 OR NOT EXISTS (SELECT 1 FROM af_categories WHERE revision_id=NEW.id
        AND length(btrim(question))>0 AND length(btrim(selection_criteria_md))>0 AND length(btrim(limitations_md))>0)
        OR EXISTS(SELECT 1 FROM af_category_products WHERE revision_id=NEW.id
          AND (length(btrim(fit_summary_ja))=0 OR length(btrim(not_for_summary_ja))=0 OR length(btrim(selection_note))=0)) THEN
        RAISE EXCEPTION 'curated category is incomplete' USING ERRCODE='23514';
      END IF;
    ELSE
      SELECT count(*) INTO n FROM af_guide_products WHERE revision_id=NEW.id;
      IF n NOT BETWEEN 1 AND 3 OR (SELECT count(*) FROM af_guide_products WHERE revision_id=NEW.id AND role='primary')<>1
        OR NOT EXISTS(SELECT 1 FROM af_guides WHERE revision_id=NEW.id AND length(btrim(task))>0 AND length(btrim(task_result_md))>0
          AND length(btrim(prerequisites_md))>0 AND length(btrim(materials_md))>0 AND length(btrim(steps_md))>0 AND length(btrim(result_md))>0
          AND length(btrim(failures_md))>0 AND length(btrim(limitations_md))>0 AND length(btrim(cost_notes_md))>0 AND length(btrim(alternatives_md))>0) THEN
        RAISE EXCEPTION 'guide is incomplete' USING ERRCODE='23514';
      END IF;
      IF EXISTS(SELECT 1 FROM af_guides g JOIN af_guide_products p ON p.revision_id=g.revision_id WHERE g.revision_id=NEW.id AND g.mode='hands_on'
        AND p.role='primary' AND NOT EXISTS(SELECT 1 FROM af_guide_test_records t WHERE t.revision_id=p.revision_id AND t.product_id=p.product_id)) THEN
        RAISE EXCEPTION 'hands_on Guide requires a primary Test Record' USING ERRCODE='23514';
      END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM (SELECT product_id FROM af_comparison_products WHERE revision_id=NEW.id
      UNION ALL SELECT product_id FROM af_category_products WHERE revision_id=NEW.id
      UNION ALL SELECT product_id FROM af_guide_products WHERE revision_id=NEW.id) rel
      WHERE NOT EXISTS(SELECT 1 FROM af_products p JOIN af_product_versions v ON v.product_id=p.id
        WHERE p.id=rel.product_id AND p.public_visibility='listed' AND v.status='published' AND af_public_version_ready(v))) THEN
      RAISE EXCEPTION 'every required Product must be listed Published and public-ready' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

