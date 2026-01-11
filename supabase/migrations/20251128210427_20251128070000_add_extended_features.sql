/*
  # Extended Features for Little Masterpiece

  ## Overview
  Adds support for user profiles, shipping addresses, order tracking, 
  payment history, and content guides.

  ## New Tables

  ### 1. `profiles`
  Extended user profile with child information and signature defaults
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users, unique)
  - `child_names` (jsonb) - Array of child info {name, age}
  - `default_signature` (jsonb) - Default signature format preferences
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `shipping_addresses`
  User shipping addresses for order fulfillment
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `name` (text, not null)
  - `address_line1` (text, not null)
  - `address_line2` (text, optional)
  - `city` (text, not null)
  - `state` (text, optional)
  - `postal_code` (text, not null)
  - `country` (text, not null)
  - `is_default` (boolean, default false)
  - `created_at` (timestamptz)

  ### 3. `order_timeline`
  Track order status changes over time
  - `id` (uuid, primary key)
  - `order_id` (uuid, foreign key to orders)
  - `status` (text, not null)
  - `notes` (text, optional)
  - `created_at` (timestamptz)

  ### 4. `payment_history`
  Track all payment transactions
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to users)
  - `order_id` (uuid, optional foreign key to orders)
  - `amount_cents` (integer, not null)
  - `description` (text, not null)
  - `status` (text, not null) - pending, completed, failed, refunded
  - `created_at` (timestamptz)

  ### 5. `guides`
  Help content and educational guides
  - `id` (uuid, primary key)
  - `slug` (text, unique, not null)
  - `title` (text, not null)
  - `summary` (text, not null)
  - `content` (text, not null)
  - `thumbnail_url` (text, optional)
  - `read_time_minutes` (integer, default 5)
  - `published_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Guides are publicly readable when published
*/

-- 1. PROFILES TABLE
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

-- 2. SHIPPING ADDRESSES TABLE
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

-- 3. ORDER TIMELINE TABLE
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

-- 4. PAYMENT HISTORY TABLE
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

-- 5. GUIDES TABLE
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

-- Add foreign key to orders for shipping address
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

-- Insert sample guide content
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
