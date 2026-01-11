/*
  ============================================
  DATABASE FIX - RUN THIS IN SUPABASE SQL EDITOR
  ============================================

  This fixes all critical database issues:
  - Products table locked (nobody can browse)
  - Cart operations blocked
  - Order modifications blocked
  - Nested query failures

  INSTRUCTIONS:
  1. Go to https://bhltnhutjgyzvbcsjitp.supabase.co
  2. Click "SQL Editor" in left sidebar
  3. Copy and paste this ENTIRE file
  4. Click "Run"
  5. Wait for "Success" message
  6. Test your app!
*/

-- ============================================
-- FIX 1: Products Table RLS Policies
-- ============================================

-- Drop the broken policy that blocks everything
DROP POLICY IF EXISTS "Only admins can modify products" ON products;

-- Allow public read access to products (browsing catalog)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products'
    AND policyname = 'Products are viewable by everyone'
  ) THEN
    CREATE POLICY "Products are viewable by everyone"
      ON products FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Allow service role to manage products (admin/seeding)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'products'
    AND policyname = 'Service role can manage products'
  ) THEN
    CREATE POLICY "Service role can manage products"
      ON products FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================
-- FIX 2: Product Variants Table RLS Policies
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_variants') THEN
    EXECUTE 'ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'product_variants'
      AND policyname = 'Product variants viewable by everyone'
    ) THEN
      CREATE POLICY "Product variants viewable by everyone"
        ON product_variants FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'product_variants'
      AND policyname = 'Service role can manage variants'
    ) THEN
      CREATE POLICY "Service role can manage variants"
        ON product_variants FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

-- ============================================
-- FIX 3: Cart Items Table and Policies
-- ============================================

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

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cart_items'
    AND policyname = 'Users can view own cart items'
  ) THEN
    CREATE POLICY "Users can view own cart items"
      ON cart_items FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cart_items'
    AND policyname = 'Users can insert own cart items'
  ) THEN
    CREATE POLICY "Users can insert own cart items"
      ON cart_items FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cart_items'
    AND policyname = 'Users can update own cart items'
  ) THEN
    CREATE POLICY "Users can update own cart items"
      ON cart_items FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cart_items'
    AND policyname = 'Users can delete own cart items'
  ) THEN
    CREATE POLICY "Users can delete own cart items"
      ON cart_items FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_artwork_id ON cart_items(artwork_id);

-- ============================================
-- FIX 4: Order Items Update/Delete Policies
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items'
    AND policyname = 'Users can update own pending order items'
  ) THEN
    CREATE POLICY "Users can update own pending order items"
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'order_items'
    AND policyname = 'Users can delete own pending order items'
  ) THEN
    CREATE POLICY "Users can delete own pending order items"
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

-- ============================================
-- FIX 5: Orders Delete Policy
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
    AND policyname = 'Users can delete own pending orders'
  ) THEN
    CREATE POLICY "Users can delete own pending orders"
      ON orders FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id AND status = 'pending');
  END IF;
END $$;

-- ============================================
-- FIX 6: Shipping Addresses Nested Query Fix
-- ============================================

DROP POLICY IF EXISTS "Users can view own shipping addresses" ON shipping_addresses;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shipping_addresses'
    AND policyname = 'Users can view related shipping addresses'
  ) THEN
    CREATE POLICY "Users can view related shipping addresses"
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
  END IF;
END $$;

-- ============================================
-- FIX 7: Mockup Templates Policies
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mockup_templates') THEN
    EXECUTE 'ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'mockup_templates'
      AND policyname = 'Mockup templates viewable by everyone'
    ) THEN
      CREATE POLICY "Mockup templates viewable by everyone"
        ON mockup_templates FOR SELECT
        TO anon, authenticated
        USING (is_active = true);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'mockup_templates'
      AND policyname = 'Service role can manage mockup templates'
    ) THEN
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

SELECT '=== ✅ DATABASE FIXES APPLIED ===' as status;

SELECT
  'products' as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'products'
GROUP BY tablename

UNION ALL

SELECT
  'cart_items' as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'cart_items'
GROUP BY tablename

UNION ALL

SELECT
  'order_items' as table_name,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'order_items'
GROUP BY tablename;

SELECT 'Next: Test browsing products and adding to cart!' as next_step;
