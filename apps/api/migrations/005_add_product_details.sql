ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hit BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_description_length_check
    CHECK (description IS NULL OR char_length(btrim(description)) <= 500);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_weight_grams_check
    CHECK (weight_grams IS NULL OR weight_grams > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
