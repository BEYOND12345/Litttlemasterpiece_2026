-- =================================================================
-- LITTLE MASTERPIECE - FULL DATABASE SETUP
-- Run this entire file in Supabase SQL Editor
-- =================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================
-- MIGRATION 1: Initial Schema
-- =================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 2. ARTWORKS TABLE
CREATE TABLE IF NOT EXISTS artworks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  original_url text NOT NULL,
  processed_url text NOT NULL,
  thumbnail_url text NOT NULL,
  medium text NOT NULL DEFAULT 'Mixed Media',
  subject text NOT NULL DEFAULT 'Artwork',
  style text NOT NULL DEFAULT 'Original',
  background_color text NOT NULL DEFAULT '#FFFFFF',
  ink_color text,
  duotone_pair jsonb,
  signature jsonb NOT NULL DEFAULT '{"text":"","descriptor":"","year":"2025","position":{"x":88,"y":88}}'::jsonb,
  transform jsonb DEFAULT '{"x":0,"y":0,"scale":1}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own artworks"
  ON artworks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own artworks"
  ON artworks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own artworks"
  ON artworks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own artworks"
  ON artworks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  mockup_image_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify products"
  ON products FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_artworks_user_id ON artworks(user_id);
CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_artwork_id ON order_items(artwork_id);

-- Insert default products
INSERT INTO products (name, type, description, price_cents, mockup_image_url)
SELECT * FROM (VALUES
  ('The Gallery Frame (Oak)', 'framed', 'Museum-quality oak frame with archival matting', 8900, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=500'),
  ('Everyday Tote Bag', 'tote', 'Heavy-duty 100% cotton canvas tote', 2900, 'https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?auto=format&fit=crop&q=80&w=500'),
  ('Digital Master File', 'digital', 'High-resolution print-ready file (300 DPI)', 1500, null),
  ('Ceramic Artist Mug', 'mug', 'Premium ceramic mug with vibrant colors', 2400, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=500')
) AS t(name, type, description, price_cents, mockup_image_url)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);

-- =================================================================
-- MIGRATION 2: Extended Features
-- =================================================================

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_names jsonb DEFAULT '[]'::jsonb,
  default_signature jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SHIPPING ADDRESSES TABLE
CREATE TABLE IF NOT EXISTS shipping_addresses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text,
  postal_code text NOT NULL,
  country text NOT NULL DEFAULT 'US',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses"
  ON shipping_addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own addresses"
  ON shipping_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON shipping_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON shipping_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ORDER TIMELINE TABLE
CREATE TABLE IF NOT EXISTS order_timeline (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order timeline"
  ON order_timeline FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_timeline.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- PAYMENT HISTORY TABLE
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment history"
  ON payment_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- GUIDES TABLE
CREATE TABLE IF NOT EXISTS guides (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  thumbnail_url text,
  read_time_minutes integer DEFAULT 5,
  published_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Guides are publicly readable"
  ON guides FOR SELECT
  TO authenticated
  USING (published_at <= now());

-- Add shipping address FK to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'shipping_address_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_address_id uuid REFERENCES shipping_addresses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_order_timeline_order_id ON order_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_guides_slug ON guides(slug);
CREATE INDEX IF NOT EXISTS idx_guides_published_at ON guides(published_at DESC);

-- Insert sample guide
INSERT INTO guides (slug, title, summary, content, read_time_minutes, published_at)
SELECT * FROM (VALUES
  (
    'getting-started',
    'Getting Started with Little Masterpiece',
    'Learn how to preserve and transform your child''s artwork into beautiful keepsakes',
    E'# Getting Started\n\nWelcome to Little Masterpiece! This guide will help you get started with preserving your child''s artwork.\n\n## Step 1: Upload Your Artwork\nTake a clear photo of your child''s artwork and upload it to our platform.\n\n## Step 2: Choose a Style\nSelect from various artistic styles to enhance your child''s creation.\n\n## Step 3: Customize\nAdd personalization like signatures and adjust colors to match your vision.\n\n## Step 4: Order Prints\nChoose from frames, totes, mugs, and more to bring your artwork to life.',
    5,
    now()
  )
) AS t(slug, title, summary, content, read_time_minutes, published_at)
WHERE NOT EXISTS (SELECT 1 FROM guides LIMIT 1);

-- =================================================================
-- MIGRATION 3: Storage Bucket
-- =================================================================

-- Create artworks storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artworks',
  'artworks',
  true,
  52428800,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own artwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own artwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own artwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'artworks' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public can view artwork"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'artworks');

-- =================================================================
-- MIGRATION 4: Auto User Creation
-- =================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =================================================================
-- MIGRATION 5: E-Commerce Tables
-- =================================================================

-- Add columns to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'gelato_template_id'
  ) THEN
    ALTER TABLE products ADD COLUMN gelato_template_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'gelato_product_uid'
  ) THEN
    ALTER TABLE products ADD COLUMN gelato_product_uid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'base_price_cents'
  ) THEN
    ALTER TABLE products ADD COLUMN base_price_cents integer DEFAULT 0;
  END IF;
END $$;

-- Add columns to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'gelato_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN gelato_order_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending';
  END IF;
END $$;

-- Add columns to artworks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'print_file_url'
  ) THEN
    ALTER TABLE artworks ADD COLUMN print_file_url text;
  END IF;
END $$;

-- PRODUCT VARIANTS TABLE
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name text NOT NULL,
  size text NOT NULL,
  material text,
  color text DEFAULT 'white',
  gelato_variant_uid text,
  price_cents integer NOT NULL DEFAULT 0,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_gelato_uid ON product_variants(gelato_variant_uid);

-- CART ITEMS TABLE
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  product_variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_cents integer NOT NULL,
  gelato_mockup_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, artwork_id, product_variant_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_artwork_id ON cart_items(artwork_id);

-- GELATO ORDERS TABLE
CREATE TABLE IF NOT EXISTS gelato_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  gelato_order_id text NOT NULL UNIQUE,
  gelato_order_reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  gelato_response jsonb,
  webhook_events jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gelato_orders_order_id ON gelato_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_gelato_orders_gelato_id ON gelato_orders(gelato_order_id);

-- Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gelato_orders ENABLE ROW LEVEL SECURITY;

-- Product variants policies
CREATE POLICY "Anyone can view available product variants"
  ON product_variants FOR SELECT
  TO public
  USING (is_available = true);

-- Cart policies
CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Gelato orders policies
CREATE POLICY "Users can view gelato status for their orders"
  ON gelato_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = gelato_orders.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Function for updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cart_items_updated_at ON cart_items;
CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gelato_orders_updated_at ON gelato_orders;
CREATE TRIGGER update_gelato_orders_updated_at
  BEFORE UPDATE ON gelato_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- MIGRATION 6: Enhancement System
-- =================================================================

-- Add columns to artworks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'original_with_bg_url'
  ) THEN
    ALTER TABLE artworks ADD COLUMN original_with_bg_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'original_no_bg_url'
  ) THEN
    ALTER TABLE artworks ADD COLUMN original_no_bg_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'original_width'
  ) THEN
    ALTER TABLE artworks ADD COLUMN original_width integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'original_height'
  ) THEN
    ALTER TABLE artworks ADD COLUMN original_height integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'is_print_ready'
  ) THEN
    ALTER TABLE artworks ADD COLUMN is_print_ready boolean DEFAULT false;
  END IF;
END $$;

-- Add subscription fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_tier text DEFAULT 'free';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'credits_remaining'
  ) THEN
    ALTER TABLE profiles ADD COLUMN credits_remaining integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'total_artworks_enhanced'
  ) THEN
    ALTER TABLE profiles ADD COLUMN total_artworks_enhanced integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_expires_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_expires_at timestamptz;
  END IF;
END $$;

-- SUBSCRIPTION TIERS TABLE
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  credits_included integer NOT NULL DEFAULT 0,
  max_style_variants integer NOT NULL DEFAULT 1,
  max_resolution integer NOT NULL DEFAULT 1500,
  allows_downloads boolean DEFAULT false,
  price_cents integer NOT NULL DEFAULT 0,
  billing_period text DEFAULT 'monthly',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO subscription_tiers (tier_name, display_name, credits_included, max_style_variants, max_resolution, allows_downloads, price_cents)
VALUES
  ('free', 'Free', 1, 1, 1500, false, 0),
  ('starter', 'Starter', 10, 5, 4000, true, 999),
  ('pro', 'Professional', 999999, 5, 8000, true, 2999)
ON CONFLICT (tier_name) DO NOTHING;

-- ARTWORK STYLE VARIANTS TABLE
CREATE TABLE IF NOT EXISTS artwork_style_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  style_type text NOT NULL CHECK (style_type IN ('original', 'enhanced', 'monochrome', 'duotone', 'primary')),
  file_url text,
  thumbnail_url text,
  width integer,
  height integer,
  file_size_bytes bigint,
  generation_status text DEFAULT 'pending' CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  quality_score numeric(3, 2),
  ai_model_used text,
  generation_parameters jsonb,
  is_downloadable boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(artwork_id, style_type)
);

CREATE INDEX IF NOT EXISTS idx_style_variants_artwork_id ON artwork_style_variants(artwork_id);
CREATE INDEX IF NOT EXISTS idx_style_variants_status ON artwork_style_variants(generation_status);

-- GENERATION QUEUE TABLE
CREATE TABLE IF NOT EXISTS generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  style_type text NOT NULL,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  queue_position integer,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_queue_user_id ON generation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_created ON generation_queue(created_at);

-- CREDIT TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus', 'subscription')),
  description text NOT NULL,
  artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL,
  generation_queue_id uuid REFERENCES generation_queue(id) ON DELETE SET NULL,
  balance_after integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE artwork_style_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can view variants of their own artworks"
  ON artwork_style_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert variants for their own artworks"
  ON artwork_style_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update variants of their own artworks"
  ON artwork_style_variants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own generation queue"
  ON generation_queue FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into own generation queue"
  ON generation_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generation queue"
  ON generation_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit transactions"
  ON credit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Triggers
DROP TRIGGER IF EXISTS update_style_variants_updated_at ON artwork_style_variants;
CREATE TRIGGER update_style_variants_updated_at
  BEFORE UPDATE ON artwork_style_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_generation_queue_updated_at ON generation_queue;
CREATE TRIGGER update_generation_queue_updated_at
  BEFORE UPDATE ON generation_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscription_tiers_updated_at ON subscription_tiers;
CREATE TRIGGER update_subscription_tiers_updated_at
  BEFORE UPDATE ON subscription_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =================================================================
-- MIGRATION 7: Digitization Features
-- =================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'cleanup_level'
  ) THEN
    ALTER TABLE artworks ADD COLUMN cleanup_level text DEFAULT 'basic' CHECK (cleanup_level IN ('basic', 'aggressive', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'artifacts_detected'
  ) THEN
    ALTER TABLE artworks ADD COLUMN artifacts_detected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'perspective_corrected'
  ) THEN
    ALTER TABLE artworks ADD COLUMN perspective_corrected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'secondary_cleanup_applied'
  ) THEN
    ALTER TABLE artworks ADD COLUMN secondary_cleanup_applied boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_enabled'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitized_url'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitized_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_fidelity_score'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_fidelity_score numeric(4, 3) CHECK (digitization_fidelity_score >= 0 AND digitization_fidelity_score <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_failed'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_failed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_fallback_reason'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_fallback_reason text;
  END IF;
END $$;

-- Add digitization to subscription tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'includes_digitization'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN includes_digitization boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'digitization_credit_cost'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN digitization_credit_cost integer DEFAULT 2;
  END IF;
END $$;

UPDATE subscription_tiers
SET
  includes_digitization = CASE
    WHEN tier_name = 'free' THEN false
    WHEN tier_name = 'starter' THEN true
    WHEN tier_name = 'pro' THEN true
    ELSE false
  END,
  digitization_credit_cost = 2
WHERE tier_name IN ('free', 'starter', 'pro');

DO $$
BEGIN
  ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;
  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_transaction_type_check
    CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus', 'subscription', 'digitization'));
END $$;

-- =================================================================
-- MIGRATION 8: Intelligent Style Processing
-- =================================================================

CREATE TABLE IF NOT EXISTS artwork_masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  master_url text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(artwork_id)
);

CREATE TABLE IF NOT EXISTS style_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  style_type text NOT NULL CHECK (style_type IN ('original_clean', 'enhanced_print', 'monochrome', 'duotone')),
  variant_url text NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  processing_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'master_id'
  ) THEN
    ALTER TABLE artworks ADD COLUMN master_id uuid REFERENCES artwork_masters(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'active_variant_id'
  ) THEN
    ALTER TABLE artworks ADD COLUMN active_variant_id uuid REFERENCES style_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artwork_masters_artwork_id ON artwork_masters(artwork_id);
CREATE INDEX IF NOT EXISTS idx_style_variants_artwork_id ON style_variants(artwork_id);
CREATE INDEX IF NOT EXISTS idx_style_variants_lookup ON style_variants(artwork_id, style_type, ((settings->>'ink_color')), ((settings->>'background_color')));

ALTER TABLE artwork_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own artwork masters"
  ON artwork_masters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_masters.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own artwork masters"
  ON artwork_masters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_masters.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own artwork masters"
  ON artwork_masters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_masters.artwork_id
      AND artworks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_masters.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own artwork masters"
  ON artwork_masters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_masters.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own style variants"
  ON style_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own style variants"
  ON style_variants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own style variants"
  ON style_variants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own style variants"
  ON style_variants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_artwork_masters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artwork_masters_updated_at
  BEFORE UPDATE ON artwork_masters
  FOR EACH ROW
  EXECUTE FUNCTION update_artwork_masters_updated_at();

-- =================================================================
-- MIGRATION 9: Cloudinary Mockup System
-- =================================================================

CREATE TABLE IF NOT EXISTS mockup_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  product_type text NOT NULL,
  cloudinary_public_id text NOT NULL,
  placement_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS artwork_mockups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES mockup_templates(id) ON DELETE CASCADE,
  mockup_image_url text NOT NULL,
  generation_status text NOT NULL DEFAULT 'pending' CHECK (generation_status IN ('pending', 'completed', 'failed')),
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(artwork_id, template_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'cloudinary_public_id'
  ) THEN
    ALTER TABLE artworks ADD COLUMN cloudinary_public_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_artwork_mockups_artwork_id ON artwork_mockups(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_mockups_template_id ON artwork_mockups(template_id);
CREATE INDEX IF NOT EXISTS idx_artwork_mockups_status ON artwork_mockups(generation_status);
CREATE INDEX IF NOT EXISTS idx_mockup_templates_product_type ON mockup_templates(product_type);
CREATE INDEX IF NOT EXISTS idx_mockup_templates_active ON mockup_templates(is_active) WHERE is_active = true;

ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE artwork_mockups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active mockup templates"
  ON mockup_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Users can view their own artwork mockups"
  ON artwork_mockups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_mockups.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create mockups for their artworks"
  ON artwork_mockups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_mockups.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own artwork mockups"
  ON artwork_mockups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_mockups.artwork_id
      AND artworks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_mockups.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own artwork mockups"
  ON artwork_mockups FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_mockups.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );

INSERT INTO mockup_templates (name, product_type, cloudinary_public_id, placement_config, display_order) VALUES
  (
    'Framed Art on Gallery Wall',
    'frame',
    'mockups/frame_gallery_wall',
    '{"left": "50%", "top": "50%", "width": "70%", "height": "70%", "gravity": "center"}'::jsonb,
    1
  ),
  (
    'Canvas on Wooden Shelf',
    'canvas',
    'mockups/canvas_wooden_shelf',
    '{"left": "50%", "top": "45%", "width": "65%", "height": "65%", "gravity": "center"}'::jsonb,
    2
  ),
  (
    'White T-Shirt Flatlay',
    'tshirt',
    'mockups/tshirt_flatlay',
    '{"left": "50%", "top": "48%", "width": "40%", "height": "40%", "gravity": "center"}'::jsonb,
    3
  ),
  (
    'Ceramic Mug on Desk',
    'mug',
    'mockups/mug_on_desk',
    '{"left": "50%", "top": "50%", "width": "45%", "height": "45%", "gravity": "center"}'::jsonb,
    4
  )
ON CONFLICT DO NOTHING;

-- =================================================================
-- SETUP COMPLETE!
-- =================================================================