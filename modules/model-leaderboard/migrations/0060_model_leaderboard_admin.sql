-- Observation dates are distinct from row import/update timestamps. Older values stay undated.
ALTER TABLE lb_prices ADD COLUMN verified_on date;
ALTER TABLE lb_prices ADD COLUMN price_origin text NOT NULL DEFAULT 'unknown'
  CHECK (price_origin IN ('unknown', 'seed', 'manual'));
ALTER TABLE lb_models ADD COLUMN context_source_url text;
ALTER TABLE lb_models ADD COLUMN context_verified_at timestamptz;
