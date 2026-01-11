/*
  # Add Gelato Template IDs to Products

  1. Changes
    - Add `gelato_template_id` column to `products` table
    - Add `gelato_store_id` to store configuration
    - This enables template-based mockup generation via Gelato API

  2. Notes
    - Template IDs must be created manually in Gelato dashboard
    - Each product type needs its own template
    - Templates define mockup settings and print specifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'gelato_template_id'
  ) THEN
    ALTER TABLE products ADD COLUMN gelato_template_id text;
  END IF;
END $$;

COMMENT ON COLUMN products.gelato_template_id IS 'Gelato template ID for generating mockups and products';