/*
  # Comprehensive Security and Architecture Fixes

  ## Overview
  Critical security fixes for server-side order processing, idempotency, and audit logging.
  This migration enforces that orders, credits, and audit events can ONLY be created/modified
  by Edge Functions using the service role, preventing client-side manipulation.

  ## 1. Drop Unsafe Client Policies
  ### orders table
  - Remove INSERT policy (orders must be created server-side via Edge Functions)
  - Remove UPDATE policy (status updates must be server-side only)

  ### order_items table
  - Remove INSERT policy (order items must be created server-side with orders)

  ## 2. New Tables

  ### audit_events
  System-wide audit log for all significant actions.
  - `id` (uuid, primary key)
  - `user_id` (uuid, nullable) - NULL for system events, user ID for user actions
  - `event_type` (text, not null) - Type of event (order_created, credit_spent, etc.)
  - `event_data` (jsonb, not null) - Event details
  - `ip_address` (text, nullable)
  - `user_agent` (text, nullable)
  - `created_at` (timestamptz, default now())

  **Security:**
  - Users can SELECT only their own events (NULL user_id remains invisible)
  - NO INSERT/UPDATE/DELETE policies (server-only via service role)

  ### credit_ledger
  Immutable ledger of all credit transactions.
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null)
  - `transaction_type` (text, not null) - purchase, spend, refund, bonus, system_grant
  - `amount` (integer, not null) - Positive for credit, negative for debit
  - `balance_after` (integer, not null) - Snapshot for reconciliation
  - `description` (text, not null)
  - `related_order_id` (uuid, nullable)
  - `related_artwork_id` (uuid, nullable)
  - `idempotency_key` (text, nullable, unique when present) - Prevents duplicate transactions
  - `created_at` (timestamptz, default now())

  **Security:**
  - Users can SELECT only their own ledger
  - NO INSERT/UPDATE/DELETE policies (server-only via service role)

  ### credits (VIEW)
  Derived view showing current credit balance per user.
  - Calculated from credit_ledger SUM
  - Read-only view (no direct manipulation)

  ### artwork_versions
  Versioned artwork processing pipeline.
  - `id` (uuid, primary key)
  - `artwork_id` (uuid, not null) - Parent artwork
  - `version_number` (integer, not null)
  - `version_type` (text, not null) - original, enhanced, style_variant
  - `file_url` (text, not null)
  - `print_file_url` (text, nullable) - Print-ready file (300 DPI)
  - `thumbnail_url` (text, nullable)
  - `status` (text, not null) - pending, processing, completed, failed
  - `is_print_ready` (boolean, default false)
  - `width_px` (integer)
  - `height_px` (integer)
  - `dpi` (integer)
  - `processing_details` (jsonb, default '{}')
  - `created_at` (timestamptz, default now())
  - `completed_at` (timestamptz, nullable)

  ## 3. Schema Updates

  ### order_items
  - Add `artwork_version_id` (references artwork_versions)
  - Add unique constraint on (order_id, artwork_version_id, product_id)
  - This prevents duplicate line items and enables server-side quantity merging

  ### orders
  - Add `idempotency_key` (text, nullable, unique when present)
  - Prevents duplicate order creation on client retries

  ## 4. Indexes
  - Performance indexes for common queries
  - Unique indexes for idempotency keys

  ## 5. Important Notes

  **Server-Side Only Operations:**
  - Creating orders (Edge Function: create-order)
  - Adding order items (Edge Function: create-order)
  - Credit transactions (Edge Function: process-payment, grant-credits)
  - Audit logging (All Edge Functions)

  **Client-Side Allowed:**
  - Reading own orders, order_items, credits, audit_events
  - CRUD on artworks (with RLS)
  - CRUD on cart_items (with RLS)
*/

-- ============================================================================
-- 1. DROP UNSAFE CLIENT POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can create own orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
DROP POLICY IF EXISTS "Users can create own order items" ON order_items;

-- ============================================================================
-- 2. CREATE AUDIT_EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit events" ON audit_events;
CREATE POLICY "Users can view own audit events"
  ON audit_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. CREATE CREDIT_LEDGER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_ledger (
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

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency_key_unique
  ON credit_ledger(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON credit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_transaction_type ON credit_ledger(transaction_type);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit ledger" ON credit_ledger;
CREATE POLICY "Users can view own credit ledger"
  ON credit_ledger FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CREATE CREDITS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW credits AS
SELECT
  user_id,
  COALESCE(SUM(amount), 0) AS balance,
  COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS total_earned,
  COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS total_spent,
  MAX(created_at) AS last_transaction_at
FROM credit_ledger
GROUP BY user_id;

-- ============================================================================
-- 5. CREATE ARTWORK_VERSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS artwork_versions (
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

CREATE INDEX IF NOT EXISTS idx_artwork_versions_artwork_id ON artwork_versions(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_versions_status ON artwork_versions(status);
CREATE INDEX IF NOT EXISTS idx_artwork_versions_version_type ON artwork_versions(version_type);

ALTER TABLE artwork_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own artwork versions" ON artwork_versions;
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

DROP POLICY IF EXISTS "Users can create own artwork versions" ON artwork_versions;
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

DROP POLICY IF EXISTS "Users can update own artwork versions" ON artwork_versions;
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

DROP POLICY IF EXISTS "Users can delete own artwork versions" ON artwork_versions;
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

-- ============================================================================
-- 6. UPDATE ORDER_ITEMS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'artwork_version_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN artwork_version_id uuid REFERENCES artwork_versions(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_items_unique_line'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_unique_line
      UNIQUE (order_id, artwork_version_id, product_id);
  END IF;
END $$;

-- ============================================================================
-- 7. UPDATE ORDERS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE orders ADD COLUMN idempotency_key text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_unique
  ON orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 8. VERIFY MOCKUP_TEMPLATES IS READ-ONLY
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'mockup_templates'
  ) THEN
    ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can insert mockup templates" ON mockup_templates;
    DROP POLICY IF EXISTS "Users can update mockup templates" ON mockup_templates;
    DROP POLICY IF EXISTS "Users can delete mockup templates" ON mockup_templates;
    DROP POLICY IF EXISTS "Authenticated users can view mockup templates" ON mockup_templates;

    CREATE POLICY "Authenticated users can view mockup templates"
      ON mockup_templates FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 9. HELPER FUNCTION FOR LOGGING
-- ============================================================================

CREATE OR REPLACE FUNCTION log_audit_event(
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
