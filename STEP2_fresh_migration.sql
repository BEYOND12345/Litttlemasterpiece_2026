-- STEP 2: FRESH MIGRATION
-- Run this AFTER running STEP1_cleanup.sql
--
-- Secure Architecture Migration
-- Complete security overhaul to enforce server-side order processing and credit management

-- Create audit_events table
CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit events"
  ON audit_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create credit_ledger table
CREATE TABLE credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'refund', 'bonus', 'system_grant')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  description text NOT NULL,
  related_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  related_artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL,
  idempotency_key text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX credit_ledger_idempotency_key_unique
  ON credit_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX idx_credit_ledger_created_at ON credit_ledger(created_at DESC);
CREATE INDEX idx_credit_ledger_transaction_type ON credit_ledger(transaction_type);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit ledger"
  ON credit_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create credits view
CREATE VIEW credits AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0) AS balance,
  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_earned,
  COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_spent,
  MAX(created_at) AS last_transaction_at
FROM credit_ledger
GROUP BY user_id;

-- Create artwork_versions table
CREATE TABLE artwork_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  version_type text NOT NULL CHECK (version_type IN ('original', 'enhanced', 'style_variant', 'digitized')),
  file_url text NOT NULL,
  print_file_url text,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  is_print_ready boolean DEFAULT false,
  width_px integer,
  height_px integer,
  dpi integer,
  processing_details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  UNIQUE(artwork_id, version_number)
);

CREATE INDEX idx_artwork_versions_artwork_id ON artwork_versions(artwork_id);
CREATE INDEX idx_artwork_versions_status ON artwork_versions(status);
CREATE INDEX idx_artwork_versions_version_type ON artwork_versions(version_type);

ALTER TABLE artwork_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own artwork versions"
  ON artwork_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_versions.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own artwork versions"
  ON artwork_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_versions.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own artwork versions"
  ON artwork_versions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_versions.artwork_id
      AND artworks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_versions.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own artwork versions"
  ON artwork_versions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_versions.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

-- Add columns to existing tables
ALTER TABLE order_items ADD COLUMN artwork_version_id uuid REFERENCES artwork_versions(id) ON DELETE RESTRICT;
ALTER TABLE order_items ADD CONSTRAINT order_items_unique_line UNIQUE (order_id, artwork_version_id, product_id);

ALTER TABLE orders ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX orders_idempotency_key_unique ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Lock down mockup_templates to read-only
ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view mockup templates"
  ON mockup_templates FOR SELECT
  TO authenticated
  USING (true);

-- Helper function for audit logging
CREATE FUNCTION log_audit_event(
  p_user_id uuid,
  p_event_type text,
  p_event_data jsonb DEFAULT '{}'::jsonb,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO audit_events (user_id, event_type, event_data, ip_address, user_agent)
  VALUES (p_user_id, p_event_type, p_event_data, p_ip_address, p_user_agent)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;
