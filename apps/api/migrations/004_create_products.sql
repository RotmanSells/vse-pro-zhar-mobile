CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  base_price_minor INTEGER NOT NULL CHECK (base_price_minor > 0),
  admin_enabled BOOLEAN NOT NULL
);
