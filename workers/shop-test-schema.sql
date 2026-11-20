CREATE TABLE IF NOT EXISTS shop_test_orders (
  session_id TEXT PRIMARY KEY,
  product TEXT NOT NULL CHECK (product IN ('plush', 'coloring')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency = 'sek'),
  confirmed_at INTEGER NOT NULL
);
