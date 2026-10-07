-- Billing limits are durable provider state, not a retryable failure of each article.
CREATE TABLE provider_pauses (
  service text PRIMARY KEY,
  reason text NOT NULL,
  paused_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO budgets (service, per_minute, per_hour, per_day)
VALUES ('openai', 60, 600, 2500)
ON CONFLICT (service) DO NOTHING;
