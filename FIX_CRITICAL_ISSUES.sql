/*
  CRITICAL DATABASE FIXES

  This script fixes all critical and high-priority issues found in the audit.
  Run this IMMEDIATELY in your Supabase SQL Editor.

  ⚠️ IMPORTANT: Run this AFTER all migrations have been applied.
*/

-- ============================================================================
-- FIX #1: Remove duplicate shipping_addresses definition
-- ============================================================================
-- The table already exists from the ecommerce migration, so no action needed
-- Just documenting that we're using the version with the phone field

-- ============================================================================
-- FIX #2: Fix products admin policy - Allow service role to modify
-- ============================================================================
DROP POLICY IF EXISTS "Only admins can modify products" ON products;

-- Service role can insert products
CREATE POLICY "Service role can insert products"
  ON products FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update products
CREATE POLICY "Service role can update products"
  ON products FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete products
CREATE POLICY "Service role can delete products"
  ON products FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- FIX #3: Add missing DELETE policy for orders
-- ============================================================================
CREATE POLICY "Users can delete own pending orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND status = 'pending'
  );

-- ============================================================================
-- FIX #4: Add missing UPDATE and DELETE policies for order_items
-- ============================================================================
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

-- ============================================================================
-- FIX #5: Make products viewable by public (before login)
-- ============================================================================
DROP POLICY IF EXISTS "Products are publicly readable" ON products;

CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  TO public
  USING (true);

-- ============================================================================
-- FIX #6: Make product_variants viewable by public
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view available product variants" ON product_variants;

CREATE POLICY "Anyone can view available product variants"
  ON product_variants FOR SELECT
  TO public
  USING (is_available = true);

-- ============================================================================
-- FIX #7: Add missing indexes on foreign keys
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address ON orders(shipping_address_id);
CREATE INDEX IF NOT EXISTS idx_artworks_master_id ON artworks(master_id);
CREATE INDEX IF NOT EXISTS idx_artworks_active_variant ON artworks(active_variant_id);
CREATE INDEX IF NOT EXISTS idx_artworks_cloudinary_id ON artworks(cloudinary_public_id);

-- ============================================================================
-- FIX #8: Add CHECK constraints on status fields
-- ============================================================================

-- Orders status constraint
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Orders payment_status constraint
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Payment history status constraint
DO $$
BEGIN
  ALTER TABLE payment_history DROP CONSTRAINT IF EXISTS payment_history_status_check;
  ALTER TABLE payment_history ADD CONSTRAINT payment_history_status_check
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- FIX #9: Add quantity upper limit to cart_items
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
-- FIX #10: Add policies for guides management (service role)
-- ============================================================================

-- Service role can insert guides
CREATE POLICY "Service role can insert guides"
  ON guides FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update guides
CREATE POLICY "Service role can update guides"
  ON guides FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete guides
CREATE POLICY "Service role can delete guides"
  ON guides FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- FIX #11: Add policies for mockup_templates management
-- ============================================================================

-- Service role can insert mockup templates
CREATE POLICY "Service role can insert mockup templates"
  ON mockup_templates FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can update mockup templates
CREATE POLICY "Service role can update mockup templates"
  ON mockup_templates FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Service role can delete mockup templates
CREATE POLICY "Service role can delete mockup templates"
  ON mockup_templates FOR DELETE
  TO service_role
  USING (true);

-- Service role can view all templates (including inactive)
CREATE POLICY "Service role can view all mockup templates"
  ON mockup_templates FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- FIX #12: Add subscription tiers management policies
-- ============================================================================

-- Service role can modify subscription tiers
CREATE POLICY "Service role can insert subscription tiers"
  ON subscription_tiers FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update subscription tiers"
  ON subscription_tiers FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete subscription tiers"
  ON subscription_tiers FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- FIX #13: Add product_variants management policies
-- ============================================================================

CREATE POLICY "Service role can insert product variants"
  ON product_variants FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update product variants"
  ON product_variants FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete product variants"
  ON product_variants FOR DELETE
  TO service_role
  USING (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify fixes were applied:

-- Check products policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;

-- Check orders policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;

-- Check order_items policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'order_items'
ORDER BY policyname;

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'order_items', 'artworks', 'cart_items')
ORDER BY tablename, indexname;

-- Check constraints
SELECT
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid::regclass::text IN ('orders', 'order_items', 'cart_items', 'payment_history')
  AND contype = 'c'
ORDER BY table_name, constraint_name;

/*
  ============================================================================
  NEXT STEPS AFTER RUNNING THIS SCRIPT:
  ============================================================================

  1. ✅ Verify all policies with the verification queries above
  2. ✅ Delete duplicate migration file:
     - Delete: supabase/migrations/20251128210355_20251128055713_create_initial_schema.sql
  3. ✅ Test the following operations:
     - Insert a new product (using service role or API)
     - Update product price
     - Create an order and delete it while pending
     - Add items to cart and modify quantity
     - Browse products without being logged in
  4. ✅ Consider consolidating the two style variant tables:
     - artwork_style_variants
     - style_variants
     Document which one to use for what purpose

  ============================================================================
  SECURITY NOTES:
  ============================================================================

  - Service role policies allow backend operations
  - Never expose service role key in client code
  - Use service role only in server-side code or edge functions
  - Public policies allow browsing before signup (good UX)
  - All user data properly protected by RLS

*/
