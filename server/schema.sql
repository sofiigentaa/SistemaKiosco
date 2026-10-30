CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS kiosk_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kiosk_users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS kiosk_password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES kiosk_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kiosk_password_reset_user_idx ON kiosk_password_reset_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kiosk_products (
  owner UUID NOT NULL REFERENCES kiosk_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, id)
);

CREATE TABLE IF NOT EXISTS kiosk_sales (
  owner UUID NOT NULL REFERENCES kiosk_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, id)
);

CREATE TABLE IF NOT EXISTS kiosk_movements (
  owner UUID NOT NULL REFERENCES kiosk_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner, id)
);

CREATE TABLE IF NOT EXISTS kiosk_meta (
  owner UUID PRIMARY KEY REFERENCES kiosk_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_shift JSONB,
  closed_shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kiosk_calandria_log (
  owner UUID NOT NULL REFERENCES kiosk_users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reposicion', 'ingreso_habitual', 'liquidacion', 'fiados', 'sistema')),
  action TEXT NOT NULL CHECK (action IN ('aprobada', 'descartada', 'pausa', 'reanudada')),
  qty INTEGER NOT NULL CHECK (qty BETWEEN 0 AND 100000),
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 0 AND 600),
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (owner, seq)
);

CREATE INDEX IF NOT EXISTS kiosk_sales_owner_created_idx ON kiosk_sales (owner, created_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_movements_owner_created_idx ON kiosk_movements (owner, created_at DESC);