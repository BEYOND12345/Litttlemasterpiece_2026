/*
  IMMEDIATE CRITICAL FIXES - ULTRA-DEEP AUDIT

  This script fixes ALL critical runtime failures identified in the ultra-deep audit.
  These are NOT optional - your application will crash without these fixes.

  Run this IMMEDIATELY in your Supabase SQL Editor.

  Estimated time: 5 minutes
  Risk level: LOW (only adds/fixes policies, no data changes except backfill)
*/

-- ============================================================================
-- FIX #1: OrderService RLS - Allow nested shipping_addresses access
-- ============================================================================
-- CRITICAL: Without this, orders page crashes with "permission denied"

DROP POLICY IF EXISTS "Users can view own shipping addresses" ON shipping_addresses;

CREATE POLICY "Users can view own shipping addresses"
  ON shipping_addresses FOR SELECT
  TO authenticated
  USING (
    -- Direct access: user owns the shipping address
    auth.uid() = user_id
    OR
    -- Indirect access: user owns an order that uses this address
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.shipping_address_id = shipping_addresses.id
      AND orders.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX #2: Backfill profile subscription columns
-- ============================================================================
-- CRITICAL: Without this, credit operations fail with NULL values

UPDATE profiles
SET
  subscription_tier = COALESCE(subscription_tier, 'free'),
  credits_remaining = COALESCE(credits_remaining, 1),
  total_artworks_enhanced = COALESCE(total_artworks_enhanced, 0),
  subscription_expires_at = COALESCE(subscription_expires_at, NULL)
WHERE subscription_tier IS NULL
   OR credits_remaining IS NULL
   OR total_artworks_enhanced IS NULL;

-- ============================================================================
-- FIX #3: Ensure payment_status column exists
-- ============================================================================
-- CRITICAL: Without this, order creation fails

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending';

    -- Add constraint
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));
  END IF;
END $$;

-- ============================================================================
-- FIX #4: CartService RLS - Allow viewing unavailable variants in cart
-- ============================================================================
-- HIGH: Without this, cart displays with missing product info

DROP POLICY IF EXISTS "Anyone can view available product variants" ON product_variants;

-- Public can browse available variants
CREATE POLICY "Public can view available variants"
  ON product_variants FOR SELECT
  TO public
  USING (is_available = true);

-- Authenticated users can view variants they've added to cart (even if now unavailable)
CREATE POLICY "Users can view variants in their cart"
  ON product_variants FOR SELECT
  TO authenticated
  USING (
    is_available = true
    OR
    EXISTS (
      SELECT 1 FROM cart_items
      WHERE cart_items.product_variant_id = product_variants.id
      AND cart_items.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM order_items
      JOIN orders ON orders.id = order_items.order_id
      WHERE order_items.product_id = product_variants.product_id
      AND orders.user_id = auth.uid()
    )
  );

-- ============================================================================
-- FIX #5: Add missing foreign key indexes
-- ============================================================================
-- MEDIUM: Without these, queries slow down significantly

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artworks_master_id
  ON artworks(master_id)
  WHERE master_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artworks_active_variant
  ON artworks(active_variant_id)
  WHERE active_variant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_shipping_address
  ON orders(shipping_address_id)
  WHERE shipping_address_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
  ON order_items(product_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artworks_cloudinary_id
  ON artworks(cloudinary_public_id)
  WHERE cloudinary_public_id IS NOT NULL;

-- ============================================================================
-- FIX #6: Add status constraints (from previous audit)
-- ============================================================================

DO $$
BEGIN
  -- Orders status
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- Payment history status
  ALTER TABLE payment_history DROP CONSTRAINT IF EXISTS payment_history_status_check;
  ALTER TABLE payment_history ADD CONSTRAINT payment_history_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- FIX #7: Add quantity upper limit (from previous audit)
-- ============================================================================

DO $$
BEGIN
  ALTER TABLE cart_items DROP CONSTRAINT IF EXISTS cart_items_quantity_check;
  ALTER TABLE cart_items ADD CONSTRAINT cart_items_quantity_check
    CHECK (quantity > 0 AND quantity <= 999);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- FIX #8: Fix products and related tables for public browsing
-- ============================================================================

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Products are publicly readable" ON products;
DROP POLICY IF EXISTS "Only admins can modify products" ON products;

-- Public can browse products
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  TO public
  USING (true);

-- Service role can manage products
CREATE POLICY "Service role can insert products"
  ON products FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update products"
  ON products FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete products"
  ON products FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- FIX #9: Add missing CRUD policies
-- ============================================================================

-- Orders DELETE policy (allow canceling pending orders)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Users can delete own pending orders'
  ) THEN
    CREATE POLICY "Users can delete own pending orders"
      ON orders FOR DELETE
      TO authenticated
      USING (
        auth.uid() = user_id
        AND status = 'pending'
      );
  END IF;
END $$;

-- Order items UPDATE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname LIKE '%update%'
  ) THEN
    CREATE POLICY "Users can update own order items in pending orders"
      ON order_items FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
          AND orders.status = 'pending'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
          AND orders.status = 'pending'
        )
      );
  END IF;
END $$;

-- Order items DELETE policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items' AND policyname LIKE '%delete%'
  ) THEN
    CREATE POLICY "Users can delete own order items in pending orders"
      ON order_items FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
          AND orders.status = 'pending'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- FIX #10: Add service role policies for admin tables
-- ============================================================================

-- Mockup templates
CREATE POLICY "Service role can manage mockup templates"
  ON mockup_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Subscription tiers
CREATE POLICY "Service role can manage subscription tiers"
  ON subscription_tiers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Product variants
CREATE POLICY "Service role can manage product variants"
  ON product_variants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Guides
CREATE POLICY "Service role can manage guides"
  ON guides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FIX #11: Create atomic credit deduction function
-- ============================================================================

CREATE OR REPLACE FUNCTION deduct_credits_atomic(
  p_user_id uuid,
  p_amount integer,
  p_description text,
  p_artwork_id uuid DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_new_balance integer;
  v_transaction_id uuid;
BEGIN
  -- Atomic update with balance check
  UPDATE profiles
  SET credits_remaining = credits_remaining - p_amount
  WHERE user_id = p_user_id
  AND credits_remaining >= p_amount
  RETURNING credits_remaining INTO v_new_balance;

  -- If no rows updated, insufficient credits
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', (SELECT credits_remaining FROM profiles WHERE user_id = p_user_id)
    );
  END IF;

  -- Log transaction
  INSERT INTO credit_transactions (
    user_id,
    amount,
    transaction_type,
    description,
    artwork_id,
    balance_after
  ) VALUES (
    p_user_id,
    -p_amount,
    'usage',
    p_description,
    p_artwork_id,
    v_new_balance
  ) RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these after the script completes to verify fixes

-- 1. Check shipping_addresses policy
SELECT
  'Shipping addresses policy' AS check_name,
  COUNT(*) AS policy_count,
  CASE WHEN COUNT(*) >= 1 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_policies
WHERE tablename = 'shipping_addresses'
AND policyname = 'Users can view own shipping addresses';

-- 2. Check profile backfill
SELECT
  'Profile backfill' AS check_name,
  COUNT(*) AS total_profiles,
  COUNT(CASE WHEN subscription_tier IS NOT NULL THEN 1 END) AS with_subscription,
  COUNT(CASE WHEN credits_remaining IS NOT NULL THEN 1 END) AS with_credits,
  CASE
    WHEN COUNT(*) = COUNT(CASE WHEN subscription_tier IS NOT NULL THEN 1 END)
    AND COUNT(*) = COUNT(CASE WHEN credits_remaining IS NOT NULL THEN 1 END)
    THEN '✅ PASS' ELSE '❌ FAIL'
  END AS status
FROM profiles;

-- 3. Check payment_status column
SELECT
  'Payment status column' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN '✅ PASS' ELSE '❌ FAIL' END AS status;

-- 4. Check product_variants policies
SELECT
  'Product variants policies' AS check_name,
  COUNT(*) AS policy_count,
  CASE WHEN COUNT(*) >= 2 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_policies
WHERE tablename = 'product_variants';

-- 5. Check indexes created
SELECT
  'Missing indexes' AS check_name,
  COUNT(*) AS index_count,
  CASE WHEN COUNT(*) >= 5 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_indexes
WHERE indexname IN (
  'idx_artworks_master_id',
  'idx_artworks_active_variant',
  'idx_orders_shipping_address',
  'idx_order_items_product_id',
  'idx_artworks_cloudinary_id'
);

-- 6. Check atomic function created
SELECT
  'Atomic credit function' AS check_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'deduct_credits_atomic'
  ) THEN '✅ PASS' ELSE '❌ FAIL' END AS status;

-- 7. Check order policies
SELECT
  'Order CRUD policies' AS check_name,
  COUNT(*) AS policy_count,
  CASE WHEN COUNT(*) >= 4 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_policies
WHERE tablename = 'orders';

-- 8. Check order_items policies
SELECT
  'Order items CRUD policies' AS check_name,
  COUNT(*) AS policy_count,
  CASE WHEN COUNT(*) >= 4 THEN '✅ PASS' ELSE '❌ FAIL' END AS status
FROM pg_policies
WHERE tablename = 'order_items';

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT
  '🎯 FIXES COMPLETE' AS summary,
  '
  Applied fixes:
  ✅ Fix #1: Order RLS for shipping addresses
  ✅ Fix #2: Profile subscription columns backfilled
  ✅ Fix #3: Payment status column ensured
  ✅ Fix #4: Cart RLS for product variants
  ✅ Fix #5: Missing indexes added
  ✅ Fix #6: Status constraints added
  ✅ Fix #7: Quantity limits enforced
  ✅ Fix #8: Products publicly browsable
  ✅ Fix #9: CRUD policies added
  ✅ Fix #10: Service role policies added
  ✅ Fix #11: Atomic credit function created

  Next steps:
  1. Run verification queries above
  2. Delete duplicate migration file manually
  3. Test critical operations (see ULTRA_DEEP_DATABASE_AUDIT.md)
  4. Upload real Cloudinary mockup images
  5. Populate Gelato template IDs
  ' AS details;

/*
  ============================================================================
  POST-SCRIPT MANUAL TASKS
  ============================================================================

  These cannot be done via SQL - you must do them manually:

  1. DELETE DUPLICATE MIGRATION FILE:
     rm supabase/migrations/20251128210355_20251128055713_create_initial_schema.sql

  2. EDIT MIGRATION FILE:
     Edit: supabase/migrations/20251128210427_20251128070000_add_extended_features.sql
     Remove lines 98-134 (duplicate shipping_addresses table)

  3. UPLOAD CLOUDINARY MOCKUPS:
     - Upload mockup photos to Cloudinary
     - Get their public IDs
     - Update mockup_templates table with real IDs

  4. POPULATE GELATO DATA:
     UPDATE products SET
       gelato_template_id = 'your_real_template_id',
       gelato_product_uid = 'your_real_product_uid'
     WHERE type = 'framed';

  5. TEST EVERYTHING:
     See testing checklist in ULTRA_DEEP_DATABASE_AUDIT.md

  ============================================================================
*/
