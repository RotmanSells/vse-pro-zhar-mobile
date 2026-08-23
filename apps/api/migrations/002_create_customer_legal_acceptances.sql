CREATE TABLE IF NOT EXISTS customer_legal_acceptances (
  customer_id UUID NOT NULL REFERENCES customers(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('privacy_policy', 'user_agreement')),
  document_version TEXT NOT NULL CHECK (btrim(document_version) <> ''),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id, document_type, document_version)
);
