-- Initial identities have no publication pointers. Deferred ownership FKs alone cannot enforce this.
CREATE FUNCTION af_editorial_document_draft_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state<>'draft' OR NEW.revision<>1 OR NEW.draft_revision_id IS NOT NULL
    OR NEW.published_revision_id IS NOT NULL OR NEW.public_slug IS NOT NULL OR NEW.first_published_at IS NOT NULL THEN
    RAISE EXCEPTION 'editorial Document must start as empty Draft; publish through validated transitions' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_editorial_document_draft_insert BEFORE INSERT ON af_editorial_documents
  FOR EACH ROW EXECUTE FUNCTION af_editorial_document_draft_insert();
