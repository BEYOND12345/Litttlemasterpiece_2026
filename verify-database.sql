-- ============================================
-- DATABASE VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to check database state
-- ============================================

-- Check which migrations have been applied
SELECT '=== MIGRATIONS APPLIED ===' as check_name;
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- Check all tables exist
SELECT '=== TABLES IN DATABASE ===' as check_name;
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check artworks table structure
SELECT '=== ARTWORKS TABLE COLUMNS ===' as check_name;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'artworks'
ORDER BY ordinal_position;

-- Check if critical columns exist
SELECT '=== CRITICAL COLUMN CHECK ===' as check_name;
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'artworks' AND column_name = 'cloudinary_public_id') as has_cloudinary_public_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') as has_payment_status,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address_id') as has_shipping_address_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_addresses' AND column_name = 'phone') as has_phone;

-- Check if required tables exist
SELECT '=== REQUIRED TABLES CHECK ===' as check_name;
SELECT
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') as has_users,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') as has_profiles,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'artworks') as has_artworks,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'artwork_style_variants') as has_artwork_style_variants,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'products') as has_products,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_variants') as has_product_variants,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') as has_orders,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items') as has_order_items,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shipping_addresses') as has_shipping_addresses,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items') as has_cart_items,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mockup_templates') as has_mockup_templates,
  EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'artwork_mockups') as has_artwork_mockups;

-- Check RLS is enabled
SELECT '=== RLS ENABLED CHECK ===' as check_name;
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check policies on critical tables
SELECT '=== ARTWORKS POLICIES ===' as check_name;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'artworks';

SELECT '=== PRODUCTS POLICIES ===' as check_name;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'products';

SELECT '=== ORDERS POLICIES ===' as check_name;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'orders';

SELECT '=== ORDER_ITEMS POLICIES ===' as check_name;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'order_items';

SELECT '=== CART_ITEMS POLICIES (if exists) ===' as check_name;
SELECT policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'cart_items';

-- Check storage buckets
SELECT '=== STORAGE BUCKETS ===' as check_name;
SELECT id, name, public
FROM storage.buckets;

-- Check storage policies
SELECT '=== STORAGE POLICIES ===' as check_name;
SELECT name, bucket_id, definition
FROM storage.policies
ORDER BY bucket_id;

-- Count records in key tables
SELECT '=== RECORD COUNTS ===' as check_name;
SELECT
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM profiles) as profiles_count,
  (SELECT COUNT(*) FROM artworks) as artworks_count,
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM product_variants) as product_variants_count,
  (SELECT COUNT(*) FROM orders) as orders_count;

-- Check for duplicate migrations issue
SELECT '=== CHECKING FOR ISSUES ===' as check_name;
SELECT
  CASE
    WHEN COUNT(*) > 1 THEN '❌ DUPLICATE MIGRATION DETECTED'
    ELSE '✅ No duplicate migrations'
  END as migration_check
FROM supabase_migrations.schema_migrations
WHERE name LIKE '%create_initial_schema%';

-- Summary
SELECT '=== VERIFICATION SUMMARY ===' as check_name;
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'artworks') = 0
    THEN '❌ CRITICAL: artworks table missing - migrations not applied'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'artworks' AND column_name = 'cloudinary_public_id')
    THEN '⚠️ WARNING: cloudinary_public_id column missing - run migration 20251203180354'
    WHEN (SELECT COUNT(*) FROM products) = 0
    THEN '⚠️ WARNING: No products in database - need to seed products'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products') < 2
    THEN '⚠️ WARNING: Insufficient product policies - users can\'t browse products'
    WHEN NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items')
    THEN '⚠️ WARNING: cart_items table missing - run APPLY_THIS_FIX.sql'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'cart_items') < 4
    THEN '⚠️ WARNING: Insufficient cart_items policies - run APPLY_THIS_FIX.sql'
    ELSE '✅ Database appears properly configured'
  END as status;

-- Show recommended action
SELECT '=== RECOMMENDED ACTION ===' as check_name;
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products' AND policyname = 'Only admins can modify products') > 0
    THEN '🔧 Run APPLY_THIS_FIX.sql to fix broken product policies'
    WHEN NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cart_items')
    THEN '🔧 Run APPLY_THIS_FIX.sql to create cart_items table'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'products') < 2
    THEN '🔧 Run APPLY_THIS_FIX.sql to add product policies'
    WHEN (SELECT COUNT(*) FROM products) = 0
    THEN '🌱 Run seed-products.sql to add test products'
    ELSE '✅ No action needed - database is properly configured'
  END as action;
