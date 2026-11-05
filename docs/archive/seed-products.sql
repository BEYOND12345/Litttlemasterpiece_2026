-- Seed Products and Variants for E-Commerce Store
-- This creates sample products with multiple size options
-- Replace gelato_product_uid values with actual Gelato product UIDs from their catalog

-- Insert base products
INSERT INTO products (name, type, description, price_cents, gelato_template_id, gelato_product_uid, base_price_cents)
VALUES
  ('Framed Print', 'framed', 'Premium framed print with museum-quality paper', 8900, null, 'frame_basic_a4', 8900),
  ('Canvas Print', 'canvas', 'Gallery-wrapped canvas with vibrant colors', 6500, null, 'canvas_gallery-wrap_8x10', 6500),
  ('Tote Bag', 'tote', 'Durable cotton tote bag perfect for everyday use', 2900, null, 'tote_organic-cotton', 2900),
  ('Mug', 'mug', 'Ceramic mug with your artwork', 1999, null, 'mug_white_11oz', 1999)
ON CONFLICT (id) DO NOTHING;

-- Insert product variants for Framed Prints
INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Small Frame - 8x10"',
  '8x10"',
  'Wood Frame',
  'Natural Oak',
  'frame_basic_8x10_oak',
  5900,
  true
FROM products WHERE name = 'Framed Print'
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Medium Frame - 11x14"',
  '11x14"',
  'Wood Frame',
  'Natural Oak',
  'frame_basic_11x14_oak',
  7900,
  true
FROM products WHERE name = 'Framed Print'
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Large Frame - 16x20"',
  '16x20"',
  'Wood Frame',
  'Natural Oak',
  'frame_basic_16x20_oak',
  8900,
  true
FROM products WHERE name = 'Framed Print'
ON CONFLICT (id) DO NOTHING;

-- Insert product variants for Canvas Prints
INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Small Canvas - 8x10"',
  '8x10"',
  'Gallery Wrap',
  'white',
  'canvas_gallery-wrap_8x10',
  4500,
  true
FROM products WHERE name = 'Canvas Print'
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Medium Canvas - 12x16"',
  '12x16"',
  'Gallery Wrap',
  'white',
  'canvas_gallery-wrap_12x16',
  5900,
  true
FROM products WHERE name = 'Canvas Print'
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Large Canvas - 18x24"',
  '18x24"',
  'Gallery Wrap',
  'white',
  'canvas_gallery-wrap_18x24',
  6500,
  true
FROM products WHERE name = 'Canvas Print'
ON CONFLICT (id) DO NOTHING;

-- Insert product variants for Tote Bags
INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Cotton Tote - Natural',
  'One Size',
  'Organic Cotton',
  'Natural',
  'tote_organic-cotton_natural',
  2900,
  true
FROM products WHERE name = 'Tote Bag'
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'Cotton Tote - Black',
  'One Size',
  'Organic Cotton',
  'Black',
  'tote_organic-cotton_black',
  2900,
  true
FROM products WHERE name = 'Tote Bag'
ON CONFLICT (id) DO NOTHING;

-- Insert product variants for Mugs
INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'White Mug - 11oz',
  '11oz',
  'Ceramic',
  'White',
  'mug_white_11oz',
  1999,
  true
FROM products WHERE name = 'Mug'
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_variants (product_id, name, size, material, color, gelato_variant_uid, price_cents, is_available)
SELECT
  id,
  'White Mug - 15oz',
  '15oz',
  'Ceramic',
  'White',
  'mug_white_15oz',
  2299,
  true
FROM products WHERE name = 'Mug'
ON CONFLICT (id) DO NOTHING;
