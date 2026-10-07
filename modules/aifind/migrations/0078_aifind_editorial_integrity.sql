-- Keep successful 0077 intact; make pointer deletion policy explicit like every Product FK.
ALTER TABLE af_editorial_documents DROP CONSTRAINT af_editorial_draft_owner;
ALTER TABLE af_editorial_documents ADD CONSTRAINT af_editorial_draft_owner
  FOREIGN KEY(id,draft_revision_id) REFERENCES af_editorial_revisions(document_id,id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE af_editorial_documents DROP CONSTRAINT af_editorial_published_owner;
ALTER TABLE af_editorial_documents ADD CONSTRAINT af_editorial_published_owner
  FOREIGN KEY(id,published_revision_id) REFERENCES af_editorial_revisions(document_id,id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION af_editorial_revision_draft_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'editorial revision must start as Draft; publish through validated update' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_editorial_revision_draft_insert BEFORE INSERT ON af_editorial_revisions
  FOR EACH ROW EXECUTE FUNCTION af_editorial_revision_draft_insert();
