/*
  # Little Masterpiece - Initial Database Schema

  ## Overview
  Creates the core database tables for the Little Masterpiece art preservation platform.
  This migration establishes the foundation for user authentication, artwork storage, 
  product catalog, and order management.

  ## New Tables

  ### 1. `users`
  Extended user profile information (complements Supabase auth.users)
  - `id` (uuid, primary key) - References auth.users
  - `email` (text, unique, not null)
  - `name` (text, not null)
  - `avatar_url` (text, optional)
  - `created_at` (timestamptz, default now())

  ### 2. `artworks`
  Stores all artwork information including styling and transformations
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `title` (text, not null)
  - `original_url` (text, not null) - Original uploaded image
  - `processed_url` (text, not null) - Processed/enhanced image
  - `thumbnail_url` (text, not null) - Optimized thumbnail
  - `medium` (text, not null) - Art medium (Crayon, Watercolor, etc.)
  - `subject` (text, not null) - Subject matter description
  - `style` (text, not null) - Style filter applied
  - `background_color` (text, not null) - Background hex color
  - `ink_color` (text, optional) - Monochrome ink color
  - `duotone_pair` (jsonb, optional) - Duotone color configuration
  - `signature` (jsonb, not null) - Artist signature data
  - `transform` (jsonb, optional) - Position and scale data
  - `created_at` (timestamptz, default now())

  ### 3. `products`
  Product catalog for prints, merchandise, and digital downloads
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `type` (text, not null) - Product type (framed, tote, canvas, digital, mug)
  - `description` (text, optional)
  - `price_cents` (integer, not null)
  - `mockup_image_url` (text, optional)
  - `created_at` (timestamptz, default now())

  ### 4. `orders`
  Customer orders
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `total_cents` (integer, not null)
  - `status` (text, not null) - Order status (pending, processing, shipped, delivered)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

  ### 5. `order_items`
  Individual items within orders
  - `id` (uuid, primary key)
  - `order_id` (uuid, foreign key to orders)
  - `product_id` (uuid, foreign key to products)
  - `artwork_id` (uuid, foreign key to artworks)
  - `quantity` (integer, not null, default 1)
  - `price_cents` (integer, not null)
  - `created_at` (timestamptz, default now())

  ## Security
  
  - Row Level Security (RLS) is enabled on all tables
  - Users can only access their own artworks and orders
  - Products are publicly readable
  - All tables require authentication for write operations

  ## Important Notes
  
  1. Image URLs point to Supabase Storage buckets (to be created separately)
  2. JSONB fields allow flexible storage of complex styling configurations
  3. All timestamps use UTC timezone
  4. Price stored in cents to avoid floating-point issues
*/

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_artworks_user_id ON artworks(user_id);
CREATE INDEX IF NOT EXISTS idx_artworks_created_at ON artworks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_artwork_id ON order_items(artwork_id);

-- Insert default products (using generated UUIDs)
INSERT INTO products (name, type, description, price_cents, mockup_image_url) 
SELECT * FROM (VALUES
  ('The Gallery Frame (Oak)', 'framed', 'Museum-quality oak frame with archival matting', 8900, 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=500'),
  ('Everyday Tote Bag', 'tote', 'Heavy-duty 100% cotton canvas tote', 2900, 'https://images.unsplash.com/photo-1597484662317-9bd7bdda2907?auto=format&fit=crop&q=80&w=500'),
  ('Digital Master File', 'digital', 'High-resolution print-ready file (300 DPI)', 1500, null),
  ('Ceramic Artist Mug', 'mug', 'Premium ceramic mug with vibrant colors', 2400, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&q=80&w=500')
) AS t(name, type, description, price_cents, mockup_image_url)
WHERE NOT EXISTS (SELECT 1 FROM products LIMIT 1);
