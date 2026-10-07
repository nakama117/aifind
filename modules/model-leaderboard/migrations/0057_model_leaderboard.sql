-- AI Signal JP optional module. Recreate the removed leaderboard schema; no scores are seeded.
CREATE TABLE lb_models (
  id                           text PRIMARY KEY,
  slug                         text NOT NULL UNIQUE,
  name                         text NOT NULL,
  provider                     text,
  provider_slug                text,
  released_at                  timestamptz,
  release_date_source          text,
  context_window_tokens        integer,
  metadata_source              text,
  metadata_updated_at          timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lb_aliases (
  id                text PRIMARY KEY,
  source_key        text NOT NULL,
  alias             text NOT NULL,
  normalized_alias  text NOT NULL,
  model_id          text NOT NULL REFERENCES lb_models (id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lb_aliases_lookup_idx ON lb_aliases (source_key, normalized_alias);

CREATE TABLE lb_snapshots (
  id               text PRIMARY KEY,
  source_key       text NOT NULL,
  source_name      text NOT NULL,
  source_url       text,
  license          text,
  attribution_url  text,
  content_hash     text,
  published_at     timestamptz,
  fetched_at       timestamptz NOT NULL,
  record_count     integer NOT NULL DEFAULT 0,
  metadata         jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX lb_snapshots_source_idx ON lb_snapshots (source_key, fetched_at DESC);

CREATE TABLE lb_scores (
  id                      text PRIMARY KEY,
  snapshot_id             text NOT NULL REFERENCES lb_snapshots (id) ON DELETE CASCADE,
  model_id                text NOT NULL REFERENCES lb_models (id),
  configuration_key       text NOT NULL,
  configuration_label     text,
  configuration_kind      text,
  configuration_priority  integer,
  selected_for_product    boolean NOT NULL DEFAULT false,
  selection_reason        text,
  metric_key              text NOT NULL,
  metric_name             text,
  raw_score               double precision,
  normalized_score        double precision,
  lower_bound             double precision,
  upper_bound             double precision,
  source_rank             integer,
  sample_size             integer,
  source_model_name       text,
  source_organization     text,
  source_published_at     timestamptz,
  metadata                jsonb NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lb_scores_snapshot_idx ON lb_scores (snapshot_id);
CREATE INDEX lb_scores_model_idx ON lb_scores (model_id);

CREATE TABLE lb_runs (
  id                   text PRIMARY KEY,
  methodology_version  text NOT NULL,
  generated_at         timestamptz NOT NULL,
  source_snapshot_ids  text[] NOT NULL DEFAULT '{}',
  summary              jsonb NOT NULL DEFAULT '{}',
  status               text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'failed', 'shadow', 'historical')),
  origin               text NOT NULL DEFAULT 'computed' CHECK (origin IN ('computed', 'imported')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lb_rankings (
  id                bigserial PRIMARY KEY,
  run_id            text NOT NULL REFERENCES lb_runs (id) ON DELETE CASCADE,
  board             text NOT NULL,
  model_id          text NOT NULL REFERENCES lb_models (id),
  rank              integer NOT NULL,
  score             double precision,
  uncertainty       double precision,
  coverage          double precision,
  confidence        text,
  metric_count      integer,
  summary           text,
  component_scores  jsonb,
  detail            jsonb,
  UNIQUE (run_id, board, model_id)
);

CREATE TABLE fx_rates (
  as_of        date NOT NULL,
  pair         text NOT NULL,
  rate         numeric(12, 6) NOT NULL,
  source_name  text NOT NULL,
  source_url   text,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (as_of, pair)
);


-- Official, subscription and third-party relay prices are kept apart (F11). Only 'official'
-- is shown as the API price; a model without one shows "待核验". Prices never affect ranking.
CREATE TABLE lb_prices (
  model_id      text NOT NULL REFERENCES lb_models (id),
  kind          text NOT NULL CHECK (kind IN ('official', 'subscription', 'relay')),
  currency      text NOT NULL CHECK (currency IN ('CNY', 'USD')),
  -- Per million tokens, in `currency`. cached_input is the cache-hit input price.
  input         numeric(14, 6),
  output        numeric(14, 6),
  cached_input  numeric(14, 6),
  source_url    text,
  verified_on   date,
  note          text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_id, kind)
);

-- One model per (source, alias): the fetchers record aliases idempotently.
CREATE UNIQUE INDEX lb_aliases_source_alias_key ON lb_aliases (source_key, alias);

-- A measuring scale belongs to one method, metric and dataset/protocol. Once established it is
-- immutable: adding a model or refreshing its score cannot move every other model's scale.
CREATE TABLE lb_calibrations (
  methodology_version text NOT NULL,
  unit text NOT NULL,
  protocol text NOT NULL,
  calibration jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (methodology_version, unit, protocol)
);

-- Ranking rows are written and read by run_id, board, model_id, rank, score, coverage and detail only.
-- Nothing writes these five columns any more, and nothing reads their earlier values.
ALTER TABLE lb_rankings
  DROP COLUMN IF EXISTS uncertainty,
  DROP COLUMN IF EXISTS confidence,
  DROP COLUMN IF EXISTS metric_count,
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS component_scores;

-- The day official prices were read is kept in each price file's name and note (database/seeds); the
-- stored copy on lb_prices was never shown.
ALTER TABLE lb_prices DROP COLUMN IF EXISTS verified_on;
