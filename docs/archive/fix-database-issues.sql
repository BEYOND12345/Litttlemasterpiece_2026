-- ============================================
-- FIX DATABASE ISSUES SCRIPT
-- Run this ONLY after running verify-database.sql
-- This will fix common issues found in the verification
-- ============================================

-- ============================================
-- ISSUE 1: Fix Products RLS Policies
-- Problem: Products table is locked, nobody can read/write
-- ============================================
SELECT '=== FIXING PRODUCTS POLICIES ===' as fix_step;

-- Drop the broken "admins only" policy that blocks everything
DROP POLICY IF EXISTS "Only admins can modify products" ON products;

-- Allow public read access to products (no login required)
CREATE POLICY IF NOT EXISTS "Products are viewable by everyone"
  ON products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role to manage products (for seeding/admin)
CREATE POLICY IF NOT EXISTS "Service role can manage products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ============================================
-- ISSUE 2: Fix Product Variants RLS Policies
-- Problem: Product variants need similar access
-- ============================================
SELECT '=== FIXING PRODUCT VARIANTS POLICIES ===' as fix_step;

-- Check if table exists first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_variants') THEN
    -- Enable RLS if not already enabled
    EXECUTE 'ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY';

    -- Allow public read access
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'Product variants viewable by everyone') THEN
      CREATE POLICY "Product variants viewable by everyone"
        ON product_variants FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;

    -- Allow service role to manage
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_variants' AND policyname = 'Service role can manage variants') THEN
      CREATE POLICY "Service role can manage variants"
        ON product_variants FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;


-- ============================================
-- ISSUE 3: Fix Cart Items Policies
-- Problem: Users can't modify their cart
-- ============================================
SELECT '=== FIXING CART ITEMS POLICIES ===' as fix_step;

-- Create cart_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  artwork_id uuid REFERENCES artworks(id) ON DELETE CASCADE NOT NULL,
  product_variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  gelato_mockup_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY IF NOT EXISTS "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);


-- ============================================
-- ISSUE 4: Fix Order Items Policies
-- Problem: Users can't update cart quantities
-- ============================================
SELECT '=== FIXING ORDER ITEMS POLICIES ===' as fix_step;

CREATE POLICY IF NOT EXISTS "Users can update own pending order items"
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

CREATE POLICY IF NOT EXISTS "Users can delete own pending order items"
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


-- ============================================
-- ISSUE 5: Fix Orders Policies
-- Problem: Users can't cancel pending orders
-- ============================================
SELECT '=== FIXING ORDERS POLICIES ===' as fix_step;

CREATE POLICY IF NOT EXISTS "Users can delete own pending orders"
  ON orders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');


-- ============================================
-- ISSUE 6: Fix Shipping Addresses Nested Query Issue
-- Problem: RLS blocks nested selects through foreign keys
-- ============================================
SELECT '=== FIXING SHIPPING ADDRESSES POLICIES ===' as fix_step;

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own shipping addresses" ON shipping_addresses;

-- Create new policy that allows nested queries
CREATE POLICY "Users can view own shipping addresses"
  ON shipping_addresses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.shipping_address_id = shipping_addresses.id
      AND orders.user_id = auth.uid()
    )
  );


-- ============================================
-- ISSUE 7: Ensure Mockup Templates are Readable
-- ============================================
SELECT '=== FIXING MOCKUP TEMPLATES POLICIES ===' as fix_step;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mockup_templates') THEN
    ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mockup_templates' AND policyname = 'Mockup templates viewable by everyone') THEN
      CREATE POLICY "Mockup templates viewable by everyone"
        ON mockup_templates FOR SELECT
        TO anon, authenticated
        USING (is_active = true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'mockup_templates' AND policyname = 'Service role can manage mockup templates') THEN
      CREATE POLICY "Service role can manage mockup templates"
        ON mockup_templates FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;


-- ============================================
-- VERIFICATION
-- ============================================
SELECT '=== VERIFICATION ===' as fix_step;

SELECT
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products') as products_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'cart_items') as cart_items_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'order_items') as order_items_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'orders') as orders_policies_count;

SELECT '✅ Database fixes applied successfully' as result;
SELECT 'Next step: Seed products if products table is empty' as next_step;
