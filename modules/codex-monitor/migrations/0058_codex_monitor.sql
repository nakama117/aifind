-- Codex announcements are manually reviewed public evidence, separate from account usage.
CREATE TABLE codex_monitor_events (
  id text PRIMARY KEY,
  body jsonb NOT NULL,
  withdrawn boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE codex_monitor_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
