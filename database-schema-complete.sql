/*
  # Complete Database Schema for Artwork-to-Product Creator

  ## Overview
  Full-featured schema for private artwork enhancement, product preview, and print-on-demand ordering.

  ## Tables Created

  ### 1. profiles
  - Extends auth.users with user preferences and settings
  - Stores name, avatar, notification preferences
  - One-to-one with auth.users

  ### 2. artworks
  - Parent record for user uploads
  - Stores original file URL and metadata
  - One-to-many with artwork_versions

  ### 3. artwork_versions
  - Enhanced/processed variants of artworks
  - Tracks processing state (pending, processing, completed, failed)
  - Links to parent artwork
  - Stores enhancement details and file URLs

  ### 4. products
  - Curated print products (admin-managed)
  - Maps to Gelato product IDs
  - Includes display metadata and pricing

  ### 5. product_variants
  - Size/color/material options for products
  - Maps to Gelato variant IDs
  - Stores pricing and availability

  ### 6. mockup_templates
  - Cloudinary mockup generation templates
  - Links to products for preview generation
  - Stores transformation parameters

  ### 7. orders
  - User purchase records
  - Tracks Gelato order IDs and fulfillment status
  - Stores shipping and payment details

  ### 8. order_items
  - Individual items in orders
  - Links: order → product_variant → artwork_version
  - Captures snapshot of pricing and configuration

  ### 9. credits (optional monetization)
  - User credit balances
  - One-to-one with users

  ### 10. credit_transactions (optional monetization)
  - Audit log of credit usage
  - Links to orders for purchases, artworks for usage

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Products and templates are publicly readable
  - Orders and artworks are strictly private
*/

-- Drop existing tables if you want a clean start (CAREFUL - this deletes data!)
-- DROP TABLE IF EXISTS credit_transactions CASCADE;
-- DROP TABLE IF EXISTS credits CASCADE;
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS mockup_templates CASCADE;
-- DROP TABLE IF EXISTS product_variants CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS artwork_versions CASCADE;
-- DROP TABLE IF EXISTS artworks CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- =============================================================================
-- 1. PROFILES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  notification_preferences jsonb DEFAULT '{"email": true, "order_updates": true}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- 2. ARTWORKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  original_file_url text NOT NULL,
  file_size_bytes integer,
  mime_type text,
  width_px integer,
  height_px integer,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own artworks" ON artworks;
CREATE POLICY "Users can view own artworks"
  ON artworks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own artworks" ON artworks;
CREATE POLICY "Users can create own artworks"
  ON artworks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own artworks" ON artworks;
CREATE POLICY "Users can update own artworks"
  ON artworks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own artworks" ON artworks;
CREATE POLICY "Users can delete own artworks"
  ON artworks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- 3. ARTWORK VERSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS artwork_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_type text NOT NULL CHECK (version_type IN ('original', 'enhanced', 'style_variant')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  file_url text,
  processing_details jsonb DEFAULT '{}'::jsonb,
  enhancement_params jsonb,
  width_px integer,
  height_px integer,
  dpi integer,
  is_print_ready boolean DEFAULT false,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE artwork_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own artwork versions" ON artwork_versions;
CREATE POLICY "Users can view own artwork versions"
  ON artwork_versions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own artwork versions" ON artwork_versions;
CREATE POLICY "Users can create own artwork versions"
  ON artwork_versions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own artwork versions" ON artwork_versions;
CREATE POLICY "Users can update own artwork versions"
  ON artwork_versions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own artwork versions" ON artwork_versions;
CREATE POLICY "Users can delete own artwork versions"
  ON artwork_versions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_artwork_versions_artwork_id ON artwork_versions(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_versions_status ON artwork_versions(status);

-- =============================================================================
-- 4. PRODUCTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  gelato_product_id text NOT NULL UNIQUE,
  base_price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  image_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active products" ON products;
CREATE POLICY "Anyone can view active products"
  ON products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- =============================================================================
-- 5. PRODUCT VARIANTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  gelato_variant_id text NOT NULL UNIQUE,
  size text,
  color text,
  material text,
  price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  is_available boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available product variants" ON product_variants;
CREATE POLICY "Anyone can view available product variants"
  ON product_variants FOR SELECT
  TO authenticated
  USING (is_available = true);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- =============================================================================
-- 6. MOCKUP TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS mockup_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  cloudinary_template_id text NOT NULL,
  cloudinary_public_id text NOT NULL,
  transformation_params jsonb NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active mockup templates" ON mockup_templates;
CREATE POLICY "Anyone can view active mockup templates"
  ON mockup_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_mockup_templates_product_id ON mockup_templates(product_id);

-- =============================================================================
-- 7. ORDERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number text NOT NULL UNIQUE,
  gelato_order_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'submitted_to_gelato', 'in_production', 'shipped', 'delivered', 'cancelled', 'failed')),
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  shipping_address jsonb NOT NULL,
  shipping_method text,
  tracking_number text,
  gelato_response jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own orders" ON orders;
CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own orders" ON orders;
CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- =============================================================================
-- 8. ORDER ITEMS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_variant_id uuid NOT NULL REFERENCES product_variants(id),
  artwork_version_id uuid NOT NULL REFERENCES artwork_versions(id),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents integer NOT NULL,
  total_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  mockup_url text,
  print_file_url text NOT NULL,
  gelato_item_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own order items" ON order_items;
CREATE POLICY "Users can create own order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_artwork_version_id ON order_items(artwork_version_id);

-- =============================================================================
-- 9. CREDITS TABLE (Optional Monetization)
-- =============================================================================

CREATE TABLE IF NOT EXISTS credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits" ON credits;
CREATE POLICY "Users can view own credits"
  ON credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- =============================================================================
-- 10. CREDIT TRANSACTIONS TABLE (Optional Monetization)
-- =============================================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus')),
  amount integer NOT NULL,
  balance_after integer NOT NULL,
  description text,
  related_order_id uuid REFERENCES orders(id),
  related_artwork_id uuid REFERENCES artworks(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_artworks_updated_at ON artworks;
CREATE TRIGGER update_artworks_updated_at
  BEFORE UPDATE ON artworks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.credits (user_id, balance)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
BEGIN
  RETURN 'ORD-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 100000)::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
