CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  birthday DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT customers_phone_not_blank CHECK (btrim(phone) <> ''),
  CONSTRAINT customers_name_not_blank CHECK (name IS NULL OR btrim(name) <> '')
);
