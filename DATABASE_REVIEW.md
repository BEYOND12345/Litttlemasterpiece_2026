# 🗄️ DATABASE REVIEW & FIX GUIDE

**Date:** January 8, 2026
**Status:** 🔴 Critical Issues Found

---

## 📋 EXECUTIVE SUMMARY

Your database has **critical RLS policy issues** that are blocking the app from functioning. The schema is correct, but the security policies are too restrictive.

**Main Issues:**
1. Products table is completely locked - nobody can read products
2. Cart operations blocked - can't add/update/delete cart items
3. Order modifications blocked - can't change quantities or cancel orders
4. Nested queries fail - shipping address lookups don't work

---

## 🔍 HOW TO DIAGNOSE YOUR SPECIFIC ISSUE

### Step 1: Run the Verification Script

1. Open Supabase Dashboard: https://bhltnhutjgyzvbcsjitp.supabase.co
2. Go to **SQL Editor**
3. Copy and paste the contents of `verify-database.sql`
4. Click **Run**
5. Review the output

### Step 2: Look for These Red Flags

**❌ Migrations Not Applied:**
```
MIGRATIONS APPLIED: 0 rows
```
**Fix:** Run all migration files in order from `supabase/migrations/`

**❌ Missing Tables:**
```
has_artworks: false
has_products: false
```
**Fix:** Migrations weren't applied - run them now

**❌ Missing Columns:**
```
has_cloudinary_public_id: false
```
**Fix:** Later migrations didn't run - apply migration `20251203180354`

**❌ No Products:**
```
products_count: 0
```
**Fix:** Run `seed-products.sql` to add test products

**❌ Locked Products Table:**
```
PRODUCTS POLICIES: "Only admins can modify products" (INSERT, UPDATE, DELETE)
```
**Fix:** This policy blocks everyone - needs to be replaced

---

## 🚨 MOST LIKELY ISSUE: RLS POLICIES

Based on your migrations, the most probable issue is **RLS policies are too restrictive**.

### The Problem

Your `products` table has this policy:
```sql
CREATE POLICY "Only admins can modify products"
  ON products FOR ALL
  TO authenticated
  USING (false)      -- ❌ This blocks EVERYTHING
  WITH CHECK (false); -- ❌ Including SELECT queries
```

This means **nobody** can read products, not even to browse the catalog.

### The Symptoms

When you try to use the app:
- ✅ Can sign up / sign in
- ✅ Can upload artwork
- ❌ Can't view products → "permission denied"
- ❌ Can't add to cart → "product not found"
- ❌ Can't checkout → crashes

---

## 🔧 THE FIX

### Quick Fix (5 minutes)

Run the `fix-database-issues.sql` script in Supabase SQL Editor.

This will:
1. Replace broken product policies with working ones
2. Add cart_items table with proper policies
3. Fix order modification policies
4. Fix nested query issues
5. Enable public product browsing

### Manual Fix (if you prefer)

Copy each section from `fix-database-issues.sql` and run them one at a time.

---

## 📊 WHAT THE VERIFICATION WILL SHOW

### ✅ Healthy Database Output

```
=== MIGRATIONS APPLIED ===
10 rows (all migrations present)

=== REQUIRED TABLES CHECK ===
has_users: true
has_artworks: true
has_products: true
has_cart_items: true
...all true

=== ARTWORKS POLICIES ===
4 policies found (SELECT, INSERT, UPDATE, DELETE)

=== PRODUCTS POLICIES ===
2+ policies found (including SELECT for public)

=== VERIFICATION SUMMARY ===
✅ Database appears properly configured
```

### ❌ Unhealthy Database Output

```
=== MIGRATIONS APPLIED ===
3 rows (migrations missing!)

=== REQUIRED TABLES CHECK ===
has_cart_items: false ❌
has_artwork_style_variants: false ❌

=== PRODUCTS POLICIES ===
1 policy: "Only admins can modify products" ❌

=== VERIFICATION SUMMARY ===
❌ CRITICAL: Multiple issues detected
```

---

## 🎯 STEP-BY-STEP FIX PROCESS

### Phase 1: Verify Current State (2 minutes)

```bash
# 1. Open Supabase Dashboard
https://bhltnhutjgyzvbcsjitp.supabase.co

# 2. Go to SQL Editor (left sidebar)

# 3. Run verify-database.sql
# Copy/paste contents and click "Run"

# 4. Save the output for reference
```

### Phase 2: Apply Fixes (3 minutes)

```bash
# 1. Still in SQL Editor

# 2. Run fix-database-issues.sql
# Copy/paste contents and click "Run"

# 3. Check for errors in output
# Should see "✅ Database fixes applied successfully"
```

### Phase 3: Verify Fixes Worked (1 minute)

```bash
# 1. Run verify-database.sql again

# 2. Check that:
# - products_policies_count >= 2
# - cart_items_policies_count >= 4
# - order_items_policies_count >= 4

# 3. Should see "✅ Database appears properly configured"
```

### Phase 4: Seed Test Data (2 minutes)

```bash
# 1. If products_count = 0, run seed-products.sql

# 2. Verify products exist:
SELECT * FROM products LIMIT 5;

# 3. Should see at least a few products
```

### Phase 5: Test the App (5 minutes)

```bash
# 1. Start dev server
npm run dev

# 2. Try to:
# - Sign in ✅
# - Upload artwork ✅
# - Browse products ✅ (should work now!)
# - Add to cart ✅ (should work now!)
# - View cart ✅ (should work now!)

# 3. Document any remaining issues
```

---

## 🔍 COMMON ERRORS & SOLUTIONS

### Error: "relation 'artworks' does not exist"

**Cause:** Migrations not applied

**Fix:**
```sql
-- Run migrations in order:
-- 1. supabase/migrations/20251128055713_create_initial_schema.sql
-- 2. supabase/migrations/20251128210427_20251128070000_add_extended_features.sql
-- ...continue with all files in order
```

### Error: "column 'cloudinary_public_id' does not exist"

**Cause:** Latest migration not applied

**Fix:**
```sql
-- Run this specific migration:
-- supabase/migrations/20251203180354_add_cloudinary_mockup_system.sql
```

### Error: "new row violates row-level security policy"

**Cause:** Missing or incorrect RLS policy

**Fix:**
```sql
-- Check which table is failing
-- Then run the relevant section from fix-database-issues.sql
```

### Error: "permission denied for table products"

**Cause:** Products table has blocking policy

**Fix:**
```sql
-- Run the ISSUE 1 section from fix-database-issues.sql
```

---

## 📝 WHAT YOUR CODE EXPECTS

### When Saving Artwork

The code tries to insert into `artworks` with these columns:
```sql
INSERT INTO artworks (
  user_id,
  title,
  original_url,
  processed_url,
  thumbnail_url,
  cloudinary_public_id,  -- ⚠️ Must exist
  medium,
  subject,
  style,
  background_color,
  ink_color,
  duotone_pair,
  signature,
  transform
)
```

Then tries to insert into `artwork_style_variants`:
```sql
INSERT INTO artwork_style_variants (
  artwork_id,
  style_type,
  generation_status,
  file_url,
  is_downloadable,
  generation_parameters
)
```

**Both tables must exist with these columns.**

### When Browsing Products

The code queries:
```sql
SELECT * FROM products;
```

**Must have SELECT policy that allows this.**

### When Adding to Cart

The code inserts into `cart_items`:
```sql
INSERT INTO cart_items (
  user_id,
  artwork_id,
  product_variant_id,
  quantity,
  price_cents
)
```

**Table must exist with INSERT policy.**

---

## ✅ SUCCESS CRITERIA

After running the fixes, you should be able to:

- [x] Run `SELECT * FROM products;` and see products
- [x] Run `SELECT * FROM artworks WHERE user_id = auth.uid();` and see artworks
- [x] Insert into cart_items without permission errors
- [x] Update order_items quantities
- [x] Delete pending orders
- [x] Query orders with nested shipping_addresses

---

## 🆘 IF STILL BROKEN AFTER FIXES

### Option 1: Share Verification Output

Run `verify-database.sql` and share the output so I can see exactly what's wrong.

### Option 2: Check Browser Console

Open browser console (F12) and look for errors like:
```
POST https://...supabase.co/rest/v1/artworks 400
{"code":"42P01","message":"relation 'artworks' does not exist"}
```

This tells us exactly which table/column is missing.

### Option 3: Check Supabase Logs

In Supabase Dashboard:
1. Go to **Logs** → **Database**
2. Look for "permission denied" or "does not exist" errors
3. Note which table/operation is failing

---

## 📊 DATABASE MIGRATION STATUS CHECKLIST

Run this to see which migrations were applied:

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

**Expected migrations:**
- ✅ 20251128055713 - create_initial_schema
- ✅ 20251128210427 - add_extended_features
- ✅ 20251128211539 - create_storage_bucket
- ✅ 20251128215944 - auto_create_user_profile
- ✅ 20251129024443 - add_ecommerce_tables
- ✅ 20251129031853 - add_gelato_template_ids
- ✅ 20251129032958 - add_artwork_enhancement_system
- ✅ 20251201203146 - add_digitization_and_enhanced_cleanup
- ✅ 20251202050637 - add_intelligent_style_processing
- ✅ 20251203180354 - add_cloudinary_mockup_system

**All 10 should be present.**

---

## 🚀 BOTTOM LINE

**Most likely issue:** RLS policies are blocking queries.

**Quick fix:** Run `fix-database-issues.sql`

**Time to fix:** 5-10 minutes

**After fix:** App should work end-to-end

---

**Next Step:** Run `verify-database.sql` and share the output if you need help interpreting it.
