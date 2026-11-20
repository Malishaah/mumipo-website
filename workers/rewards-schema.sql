CREATE TABLE IF NOT EXISTS picnic_wallets (
  user_id TEXT PRIMARY KEY,
  stars INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0),
  last_reward_id TEXT,
  round_id TEXT,
  started_at INTEGER
);
