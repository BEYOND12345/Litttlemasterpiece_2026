# Database Setup Guide

## Step 1: Run the Migration

1. Open your Supabase project: https://bhltnhutjgyzvbcsjitp.supabase.co
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the entire contents of `database-schema-complete.sql`
5. Paste into the editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. Wait for "Success. No rows returned" message

### If You Want a Clean Start

If you have existing tables and want to start fresh:
1. Uncomment the `DROP TABLE` statements at the top of `database-schema-complete.sql`
2. Run the script
3. All old data will be deleted and fresh tables created

---

## Step 2: Verify Tables Created

Run this query to see all tables:

```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see:
- artworks
- artwork_versions
- credit_transactions
- credits
- mockup_templates
- order_items
- orders
- product_variants
- products
- profiles

---

## Step 3: Seed Sample Products

Here's starter data for your curated product catalog:

```sql
-- Insert Products
INSERT INTO products (name, description, category, gelato_product_id, base_price_cents, image_url, display_order) VALUES
  ('Classic T-Shirt', 'Premium cotton t-shirt with your artwork', 'apparel', 'gelato_tshirt_001', 2499, '/images/mockups/Mockup_Tshirt_01.jpg', 1),
  ('Tote Bag', 'Durable canvas tote bag', 'accessories', 'gelato_tote_001', 1899, '/images/mockups/Mockup_Totebag_01.jpg', 2),
  ('Coffee Mug', 'Ceramic 11oz coffee mug', 'home', 'gelato_mug_001', 1499, '/images/mockups/Mockup_Coffecup_01.jpg', 3),
  ('Art Print', 'Museum-quality framed print', 'wall_art', 'gelato_print_001', 4999, '/images/mockups/Mockup_LargeFrame_01.jpg', 4),
  ('Phone Case', 'Protective phone case with your design', 'accessories', 'gelato_phone_001', 1999, '/images/mockups/Mockup_phonecase_01.jpg', 5)
ON CONFLICT (gelato_product_id) DO NOTHING;

-- Insert Product Variants (T-Shirt)
INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  'Small, Black',
  'gelato_tshirt_001_s_black',
  'Small',
  'Black',
  2499
FROM products WHERE gelato_product_id = 'gelato_tshirt_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  'Medium, Black',
  'gelato_tshirt_001_m_black',
  'Medium',
  'Black',
  2499
FROM products WHERE gelato_product_id = 'gelato_tshirt_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  'Large, Black',
  'gelato_tshirt_001_l_black',
  'Large',
  'Black',
  2499
FROM products WHERE gelato_product_id = 'gelato_tshirt_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

-- Insert Product Variants (Tote Bag)
INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  'Standard, Natural',
  'gelato_tote_001_natural',
  'Standard',
  'Natural',
  1899
FROM products WHERE gelato_product_id = 'gelato_tote_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

-- Insert Product Variants (Coffee Mug)
INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  '11oz, White',
  'gelato_mug_001_11oz_white',
  '11oz',
  'White',
  1499
FROM products WHERE gelato_product_id = 'gelato_mug_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

-- Insert Product Variants (Art Print)
INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  '16x20", Framed',
  'gelato_print_001_16x20_framed',
  '16x20"',
  'Framed',
  4999
FROM products WHERE gelato_product_id = 'gelato_print_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  '12x16", Framed',
  'gelato_print_001_12x16_framed',
  '12x16"',
  'Framed',
  3999
FROM products WHERE gelato_product_id = 'gelato_print_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

-- Insert Product Variants (Phone Case)
INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  'iPhone 14, Clear',
  'gelato_phone_001_iphone14_clear',
  'iPhone 14',
  'Clear',
  1999
FROM products WHERE gelato_product_id = 'gelato_phone_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;

INSERT INTO product_variants (product_id, name, gelato_variant_id, size, color, price_cents)
SELECT
  id,
  'iPhone 15, Clear',
  'gelato_phone_001_iphone15_clear',
  'iPhone 15',
  'Clear',
  1999
FROM products WHERE gelato_product_id = 'gelato_phone_001'
ON CONFLICT (gelato_variant_id) DO NOTHING;
```

---

## Step 4: Seed Mockup Templates

**Important**: Replace these with your actual Cloudinary public IDs and transformation parameters.

```sql
-- Mockup Templates
INSERT INTO mockup_templates (product_id, name, cloudinary_template_id, cloudinary_public_id, transformation_params, display_order)
SELECT
  id,
  'T-Shirt Front View',
  'tshirt_front_overlay',
  'mockups/tshirt_mockup_01',
  '{"x": 400, "y": 300, "width": 800, "height": 1000, "gravity": "center"}'::jsonb,
  1
FROM products WHERE gelato_product_id = 'gelato_tshirt_001';

INSERT INTO mockup_templates (product_id, name, cloudinary_template_id, cloudinary_public_id, transformation_params, display_order)
SELECT
  id,
  'Tote Bag Flat',
  'tote_flat_overlay',
  'mockups/tote_mockup_01',
  '{"x": 300, "y": 250, "width": 600, "height": 800, "gravity": "center"}'::jsonb,
  1
FROM products WHERE gelato_product_id = 'gelato_tote_001';

INSERT INTO mockup_templates (product_id, name, cloudinary_template_id, cloudinary_public_id, transformation_params, display_order)
SELECT
  id,
  'Coffee Mug Side View',
  'mug_side_overlay',
  'mockups/mug_mockup_01',
  '{"x": 350, "y": 280, "width": 500, "height": 600, "gravity": "center"}'::jsonb,
  1
FROM products WHERE gelato_product_id = 'gelato_mug_001';

INSERT INTO mockup_templates (product_id, name, cloudinary_template_id, cloudinary_public_id, transformation_params, display_order)
SELECT
  id,
  'Framed Print Wall',
  'frame_wall_overlay',
  'mockups/frame_mockup_01',
  '{"x": 450, "y": 350, "width": 900, "height": 1200, "gravity": "center"}'::jsonb,
  1
FROM products WHERE gelato_product_id = 'gelato_print_001';

INSERT INTO mockup_templates (product_id, name, cloudinary_template_id, cloudinary_public_id, transformation_params, display_order)
SELECT
  id,
  'Phone Case Back View',
  'phone_back_overlay',
  'mockups/phone_mockup_01',
  '{"x": 200, "y": 150, "width": 400, "height": 800, "gravity": "center"}'::jsonb,
  1
FROM products WHERE gelato_product_id = 'gelato_phone_001';
```

---

## Step 5: Configure Storage Bucket

Create a storage bucket for user uploads:

1. Go to **Storage** in Supabase dashboard
2. Click **New bucket**
3. Name it `artworks`
4. Make it **Private** (not public)
5. Click **Create bucket**

### Set Storage Policies

Run this SQL to allow users to upload their own artwork:

```sql
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload own artworks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'artworks' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Users can read own artworks"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'artworks' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete own artworks"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'artworks' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Step 6: Test User Signup

1. Go to **Authentication** > **Users**
2. Click **Add user** (or sign up via your app)
3. Create a test user

### Verify Auto-Created Records

Run this query with your test user's ID:

```sql
-- Replace 'your-user-id' with actual UUID
SELECT
  p.email,
  p.full_name,
  c.balance as credit_balance
FROM profiles p
LEFT JOIN credits c ON c.user_id = p.id
WHERE p.id = 'your-user-id';
```

You should see:
- Profile created automatically
- Credits record with balance = 0

---

## Step 7: Verify Everything Works

### Check Products Are Readable

```sql
SELECT
  p.name,
  p.category,
  COUNT(pv.id) as variant_count,
  COUNT(mt.id) as mockup_count
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id
LEFT JOIN mockup_templates mt ON mt.product_id = p.id
WHERE p.is_active = true
GROUP BY p.id, p.name, p.category
ORDER BY p.display_order;
```

You should see your 5 products with their variant and mockup counts.

### Check RLS Works

Log in as your test user in the app and try:
1. Creating an artwork
2. Viewing your artworks (should succeed)
3. Viewing products (should succeed)
4. Viewing other users' artworks (should fail/return empty)

---

## Troubleshooting

### Issue: "relation already exists"
- You have old tables. Uncomment DROP statements in migration file.

### Issue: "permission denied"
- RLS is blocking you. Make sure you're authenticated as a user, not using service role.

### Issue: Products not showing
- Check `is_active = true` on products
- Verify user is authenticated

### Issue: Can't upload to storage
- Check storage bucket exists and is named `artworks`
- Verify storage policies are created

---

## Next Steps

Now that your database is set up:

1. **Map Gelato IDs**: Replace placeholder `gelato_product_id` values with real Gelato product/variant IDs
2. **Upload Mockup Images**: Upload mockup templates to Cloudinary and update `cloudinary_public_id` values
3. **Build Edge Functions**: Create enhancement, mockup generation, and order submission functions
4. **Update Frontend Services**: Connect to new schema
5. **Test End-to-End**: Upload → Enhance → Preview → Order

Your database is now ready for development!
