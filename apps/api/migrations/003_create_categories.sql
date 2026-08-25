CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200)
);
