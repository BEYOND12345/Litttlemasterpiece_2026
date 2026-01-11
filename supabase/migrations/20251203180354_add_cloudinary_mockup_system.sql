/*
  # Cloudinary Mockup System

  This migration creates the infrastructure for generating realistic product mockups using Cloudinary.

  ## New Tables

  ### mockup_templates
  - Stores base mockup photos and placement configurations
  - Each template represents a different product visualization (frame on wall, t-shirt flatlay, mug on desk, etc.)
  - Includes placement_config JSONB for artwork overlay positioning
  - Links to product_type for matching with products
  
  Fields:
  - `id` (uuid, primary key) - Unique template identifier
  - `name` (text) - Display name like "Frame on Gallery Wall"
  - `product_type` (text) - Matches products.type for filtering
  - `cloudinary_public_id` (text) - Base mockup image ID in Cloudinary
  - `placement_config` (jsonb) - Overlay positioning {left, top, width, height, rotation, scale}
  - `display_order` (integer) - Sort order for gallery display
  - `is_active` (boolean) - Enable/disable without deleting
  - `created_at` (timestamptz) - Creation timestamp

  ### artwork_mockups
  - Stores generated mockup URLs for each artwork-template combination
  - Enables lazy generation - only creates mockups when user views gallery
  - Caches Cloudinary transformation URLs for instant subsequent loads
  
  Fields:
  - `id` (uuid, primary key) - Unique mockup identifier
  - `artwork_id` (uuid, FK) - Reference to artworks table
  - `template_id` (uuid, FK) - Reference to mockup_templates table
  - `mockup_image_url` (text) - Final Cloudinary composed image URL
  - `generation_status` (text) - "pending", "completed", "failed"
  - `is_public` (boolean) - For future public gallery feature
  - `created_at` (timestamptz) - Generation timestamp
  - Unique constraint on (artwork_id, template_id) prevents duplicates

  ### artworks table modifications
  - Add `cloudinary_public_id` (text) - Stores artwork's Cloudinary ID for mockup generation
  - Keeps existing `processed_url` for Supabase storage backward compatibility

  ## Security
  - Enable RLS on both new tables
  - Users can view their own mockups
  - Users can create mockups for their own artworks
  - All users can read active mockup templates

  ## Important Notes
  1. Mockups are generated lazily when user views gallery - saves API credits
  2. Once generated, mockup URLs are permanent and cached
  3. Cloudinary handles all image composition server-side
  4. Templates must be uploaded to Cloudinary manually before seeding
*/

-- Create mockup_templates table
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

-- Create artwork_mockups table
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

-- Add cloudinary_public_id to artworks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'cloudinary_public_id'
  ) THEN
    ALTER TABLE artworks ADD COLUMN cloudinary_public_id text;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_artwork_mockups_artwork_id ON artwork_mockups(artwork_id);
CREATE INDEX IF NOT EXISTS idx_artwork_mockups_template_id ON artwork_mockups(template_id);
CREATE INDEX IF NOT EXISTS idx_artwork_mockups_status ON artwork_mockups(generation_status);
CREATE INDEX IF NOT EXISTS idx_mockup_templates_product_type ON mockup_templates(product_type);
CREATE INDEX IF NOT EXISTS idx_mockup_templates_active ON mockup_templates(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE mockup_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE artwork_mockups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mockup_templates
-- All authenticated users can view active templates
CREATE POLICY "Anyone can view active mockup templates"
  ON mockup_templates FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for artwork_mockups
-- Users can view mockups for their own artworks
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

-- Users can create mockups for their own artworks
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

-- Users can update their own artwork mockups
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

-- Users can delete their own artwork mockups
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

-- Seed initial mockup templates
-- Note: cloudinary_public_ids should be updated after uploading actual mockup photos
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