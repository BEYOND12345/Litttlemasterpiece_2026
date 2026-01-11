/*
  # Add Intelligent Style Processing System

  ## Overview
  This migration adds a two-stage pipeline for intelligent artwork processing:
  1. Master digitization (once per upload)
  2. Style variants (on-demand, cached)

  ## New Tables

  ### artwork_masters
  Stores the high-resolution cleaned master image and extracted metadata for each artwork.
  - `id` (uuid, primary key)
  - `artwork_id` (uuid, foreign key to artworks) - one-to-one relationship
  - `master_url` (text) - URL to high-res cleaned master in Supabase Storage
  - `metadata` (jsonb) - extracted analysis data:
    - medium (text) - e.g., "Crayon", "Watercolor", "Marker"
    - dominant_colors (text[]) - array of hex colors
    - subject (text) - detected subject description
    - edge_count (integer) - number of detected edges
    - resolution (object) - { width, height }
    - paper_color (text) - detected paper background color
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### style_variants
  Stores cached style-processed versions of artworks for instant re-selection.
  - `id` (uuid, primary key)
  - `artwork_id` (uuid, foreign key to artworks)
  - `style_type` (text) - enum-like: 'original_clean', 'enhanced_print', 'monochrome', 'duotone'
  - `variant_url` (text) - URL to processed style variant in Supabase Storage
  - `settings` (jsonb) - style-specific settings:
    - ink_color (text) - for monochrome
    - duotone_dark (text) - for duotone
    - duotone_light (text) - for duotone
    - background_color (text) - selected background
  - `processing_metadata` (jsonb) - what processing was applied
  - `created_at` (timestamptz)

  ### artwork updates
  - Add `master_id` foreign key to artwork_masters
  - Add `active_variant_id` foreign key to style_variants

  ## Security
  - Enable RLS on all new tables
  - Users can only access their own artwork masters and variants
  - Authenticated users only

  ## Indexes
  - Index on artwork_id for fast lookups
  - Composite index on (artwork_id, style_type, settings) for cache checks
*/

-- Create artwork_masters table
CREATE TABLE IF NOT EXISTS artwork_masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  master_url text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(artwork_id)
);

-- Create style_variants table
CREATE TABLE IF NOT EXISTS style_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id uuid NOT NULL REFERENCES artworks(id) ON DELETE CASCADE,
  style_type text NOT NULL CHECK (style_type IN ('original_clean', 'enhanced_print', 'monochrome', 'duotone')),
  variant_url text NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  processing_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add columns to artworks table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_artwork_masters_artwork_id ON artwork_masters(artwork_id);
CREATE INDEX IF NOT EXISTS idx_style_variants_artwork_id ON style_variants(artwork_id);
CREATE INDEX IF NOT EXISTS idx_style_variants_lookup ON style_variants(artwork_id, style_type, ((settings->>'ink_color')), ((settings->>'background_color')));

-- Enable RLS
ALTER TABLE artwork_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for artwork_masters
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

-- RLS Policies for style_variants
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

-- Create updated_at trigger for artwork_masters
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