-- Fact writes lock their version but do not update it. An old Repeatable Read snapshot can
-- therefore miss a committed draft edit. Publication must validate under Read Committed.
CREATE FUNCTION af_require_publication_isolation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='published' AND current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'publication requires read committed isolation' USING ERRCODE='25000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_publication_isolation BEFORE INSERT OR UPDATE ON af_product_versions
FOR EACH ROW EXECUTE FUNCTION af_require_publication_isolation();
