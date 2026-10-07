-- Transport receipts; never a source of published Product facts.
CREATE TABLE af_catalog_imports (
  pack_id text NOT NULL, revision bigint NOT NULL CHECK(revision>0),
  content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
  data_kind text NOT NULL CHECK(data_kind IN ('synthetic','source_material')),
  products jsonb NOT NULL CHECK(jsonb_typeof(products)='array'),
  actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(pack_id,revision)
);
CREATE TABLE af_catalog_evidence (
  identity_hash text PRIMARY KEY CHECK(identity_hash ~ '^[a-f0-9]{64}$'),
  evidence_id text NOT NULL UNIQUE REFERENCES af_evidence(id) ON DELETE RESTRICT
);
