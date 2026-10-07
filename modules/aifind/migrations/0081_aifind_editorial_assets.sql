-- Persistent, sanitized files. Upload never grants publication clearance.
CREATE TABLE af_editorial_assets (
  id text PRIMARY KEY,
  original_sha256 text NOT NULL CHECK(original_sha256 ~ '^[a-f0-9]{64}$'),
  processed_sha256 text NOT NULL CHECK(processed_sha256 ~ '^[a-f0-9]{64}$'),
  mime text NOT NULL CHECK(mime='image/webp'),
  byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 5242880),
  width integer NOT NULL CHECK(width BETWEEN 1 AND 2400),
  height integer NOT NULL CHECK(height BETWEEN 1 AND 2400),
  storage_key text NOT NULL CHECK(storage_key='uploads/aifind-editorial/'||processed_sha256||'.webp'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  uploader text NOT NULL CHECK(length(btrim(uploader)) BETWEEN 1 AND 200),
  rights_basis text NOT NULL DEFAULT 'unreviewed' CHECK(rights_basis IN ('unreviewed','self_captured','owned','licensed')),
  rights_note text NOT NULL DEFAULT '' CHECK(length(rights_note)<=2000),
  source_url text CHECK(source_url IS NULL OR source_url ~ '^https?://'),
  rights_reviewed_at timestamptz, rights_reviewer text,
  privacy_reviewed_at timestamptz, privacy_reviewer text,
  CHECK((rights_reviewed_at IS NULL)=(rights_reviewer IS NULL)),
  CHECK((privacy_reviewed_at IS NULL)=(privacy_reviewer IS NULL)),
  CHECK(rights_reviewed_at IS NULL OR (rights_basis<>'unreviewed' AND length(btrim(rights_note))>0))
);
CREATE TABLE af_editorial_revision_assets (
  revision_id text NOT NULL REFERENCES af_guides(revision_id) ON DELETE RESTRICT,
  asset_id text NOT NULL REFERENCES af_editorial_assets(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK(role IN ('cover','step','result','reference')),
  position integer NOT NULL CHECK(position BETWEEN 1 AND 30),
  caption_ja text NOT NULL DEFAULT '' CHECK(length(caption_ja)<=2000),
  alt_ja text NOT NULL DEFAULT '' CHECK(length(alt_ja)<=500),
  PRIMARY KEY(revision_id,asset_id), UNIQUE(revision_id,position)
);
CREATE INDEX af_asset_revision_relations ON af_editorial_revision_assets(asset_id,revision_id);
CREATE TRIGGER af_guide_assets_guard BEFORE INSERT OR UPDATE OR DELETE ON af_editorial_revision_assets FOR EACH ROW EXECUTE FUNCTION af_guard_guide_child();
CREATE FUNCTION af_guard_editorial_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'asset history cannot be deleted' USING ERRCODE='23514'; END IF;
  IF (to_jsonb(NEW)-ARRAY['rights_basis','rights_note','source_url','rights_reviewed_at','rights_reviewer','privacy_reviewed_at','privacy_reviewer'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['rights_basis','rights_note','source_url','rights_reviewed_at','rights_reviewer','privacy_reviewed_at','privacy_reviewer']) THEN
    RAISE EXCEPTION 'asset identity and sanitized binary metadata are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_editorial_asset_guard BEFORE UPDATE OR DELETE ON af_editorial_assets FOR EACH ROW EXECUTE FUNCTION af_guard_editorial_asset();
CREATE FUNCTION af_guard_guide_asset_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.published_at IS NOT NULL AND OLD.published_at IS NULL AND EXISTS(
    SELECT 1 FROM af_editorial_revision_assets r JOIN af_editorial_assets a ON a.id=r.asset_id
    WHERE r.revision_id=NEW.id AND (length(btrim(r.caption_ja))=0 OR length(btrim(r.alt_ja))=0
      OR a.rights_basis='unreviewed' OR a.rights_reviewed_at IS NULL OR a.privacy_reviewed_at IS NULL)) THEN
    RAISE EXCEPTION 'every Guide asset requires caption, alt, rights and privacy review' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER af_guide_asset_publish_guard BEFORE UPDATE ON af_editorial_revisions FOR EACH ROW EXECUTE FUNCTION af_guard_guide_asset_publication();
