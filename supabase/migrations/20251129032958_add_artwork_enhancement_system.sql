/*
  # Artwork Enhancement System Schema

  1. New Tables
    - `artwork_style_variants`
      - Stores different style versions of each artwork
      - Links to base artworks table
      - Tracks generation status, resolution, quality
    - `user_credits`
      - Tracks user credit balance and subscription tier
      - Manages freemium system
    - `credit_transactions`
      - Logs all credit usage and purchases
      - Audit trail for credits
    - `generation_queue`
      - Manages async AI generation jobs
      - Tracks progress and status
    - `subscription_tiers`
      - Defines available subscription plans
      - Pricing and feature limits

  2. Changes to Existing Tables
    - `artworks`: Add high-res URLs, background removal URLs, resolution tracking
    - `users` via profiles: Add subscription info

  3. Security
    - Enable RLS on all new tables
    - Users can only access their own variants, credits, and queue items
    - Transparent credit usage tracking
*/

-- Add columns to existing artworks table for enhancement system
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

-- Add subscription fields to profiles table
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

-- Create subscription_tiers table
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

-- Insert default tiers
INSERT INTO subscription_tiers (tier_name, display_name, credits_included, max_style_variants, max_resolution, allows_downloads, price_cents)
VALUES 
  ('free', 'Free', 1, 1, 1500, false, 0),
  ('starter', 'Starter', 10, 5, 4000, true, 999),
  ('pro', 'Professional', 999999, 5, 8000, true, 2999)
ON CONFLICT (tier_name) DO NOTHING;

-- Create artwork_style_variants table
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

-- Create generation_queue table
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

-- Create credit_transactions table
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

-- Enable RLS on all new tables
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE artwork_style_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Subscription tiers policies (public read)
CREATE POLICY "Anyone can view subscription tiers"
  ON subscription_tiers FOR SELECT
  TO public
  USING (true);

-- Artwork style variants policies
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

-- Generation queue policies
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

-- Credit transactions policies
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit transactions"
  ON credit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add triggers for updated_at
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
