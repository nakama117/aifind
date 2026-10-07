-- Immutable source revisions and their independent recognition results. Original text stays private.
ALTER TABLE codex_monitor_events ADD COLUMN managed_by text NOT NULL DEFAULT 'manual'
  CHECK (managed_by IN ('manual', 'automatic'));

CREATE TABLE codex_monitor_documents (
  id text PRIMARY KEY,
  document_key text NOT NULL,
  source_key text NOT NULL,
  content_hash text NOT NULL,
  url text NOT NULL,
  author text NOT NULL,
  published_at timestamptz,
  observed_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  body_text text NOT NULL,
  context jsonb NOT NULL DEFAULT '[]',
  is_current boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'review', 'failed', 'dismissed')),
  recognition jsonb,
  receipt_id bigint REFERENCES receipts(id),
  applied_ids text[] NOT NULL DEFAULT '{}',
  review_reason text,
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_key, content_hash)
);
CREATE INDEX codex_monitor_documents_pending ON codex_monitor_documents (observed_at, id)
  WHERE is_current AND status IN ('pending', 'failed');
CREATE INDEX codex_monitor_documents_source ON codex_monitor_documents (source_key, observed_at DESC);
