/*
  # E-Commerce and Gelato Integration Schema

  1. New Tables
    - `product_variants`
      - Product size, material, and Gelato mapping
      - Links to base products table
    - `cart_items`
      - Shopping cart persistence
      - Links user, artwork, and product variant
    - `gelato_orders`
      - Stores Gelato order IDs and tracking
      - Links to local orders table
    - `shipping_addresses`
      - Customer shipping information
      - Reusable addresses per user

  2. Changes to Existing Tables
    - `products`: Add gelato_template_id, gelato_product_uid
    - `orders`: Add gelato_order_id, shipping_address_id, payment_status
    - `artworks`: Add print_file_url for Gelato submission

  3. Security
    - Enable RLS on all new tables
    - Users can only access their own cart items
    - Users can only access their own shipping addresses
    - Users can only view their own orders
*/

-- Add columns to existing products table
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

-- Add columns to existing orders table
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
    WHERE table_name = 'orders' AND column_name = 'shipping_address_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_address_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_status text DEFAULT 'pending';
  END IF;
END $$;

-- Add columns to existing artworks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'print_file_url'
  ) THEN
    ALTER TABLE artworks ADD COLUMN print_file_url text;
  END IF;
END $$;

-- Create shipping_addresses table first (needed for FK)
CREATE TABLE IF NOT EXISTS shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text,
  postal_code text NOT NULL,
  country text NOT NULL,
  phone text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON shipping_addresses(user_id);

-- Now add FK constraint to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_shipping_address_id_fkey'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_shipping_address_id_fkey 
      FOREIGN KEY (shipping_address_id) REFERENCES shipping_addresses(id);
  END IF;
END $$;

-- Create product_variants table
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

-- Create cart_items table
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

-- Create gelato_orders table
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

-- Enable RLS on all new tables
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE gelato_orders ENABLE ROW LEVEL SECURITY;

-- Product variants policies (public read, admin write)
CREATE POLICY "Anyone can view available product variants"
  ON product_variants FOR SELECT
  TO public
  USING (is_available = true);

-- Cart items policies
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

-- Shipping addresses policies
CREATE POLICY "Users can view own shipping addresses"
  ON shipping_addresses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shipping addresses"
  ON shipping_addresses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shipping addresses"
  ON shipping_addresses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shipping addresses"
  ON shipping_addresses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Gelato orders policies (users can view their order's gelato status)
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
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

DROP TRIGGER IF EXISTS update_shipping_addresses_updated_at ON shipping_addresses;
CREATE TRIGGER update_shipping_addresses_updated_at
  BEFORE UPDATE ON shipping_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gelato_orders_updated_at ON gelato_orders;
CREATE TRIGGER update_gelato_orders_updated_at
  BEFORE UPDATE ON gelato_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();