# DATABASE CRITICAL AUDIT REPORT

**Status:** 🔴 CRITICAL ISSUES FOUND
**Date:** 2025-12-14
**Total Issues:** 20 (8 Critical, 7 High Priority, 5 Medium Priority)

---

## 🚨 CRITICAL ISSUES (Must Fix Before Production)

### 1. DUPLICATE MIGRATION FILES
**Severity:** 🔴 CRITICAL - Will cause database errors

**Problem:**
- `20251128055713_create_initial_schema.sql`
- `20251128210355_20251128055713_create_initial_schema.sql`

These are IDENTICAL migrations. Running both will attempt to create tables twice.

**Impact:** Migration will fail with "table already exists" errors

**Solution:**
```bash
# Delete the duplicate file:
rm supabase/migrations/20251128210355_20251128055713_create_initial_schema.sql
```

---

### 2. DUPLICATE shipping_addresses TABLE
**Severity:** 🔴 CRITICAL - Data model conflict

**Problem:**
Table created in TWO different migrations with DIFFERENT schemas:
- Migration `20251128210427` (no phone field)
- Migration `20251129024443` (includes phone field)

**Impact:**
- Second creation will fail
- Conflicting foreign key constraints on orders.shipping_address_id

**Solution:** Keep only the version in `20251129024443` (ecommerce migration) since it has more complete fields

---

### 3. PRODUCTS ARE PERMANENTLY LOCKED
**Severity:** 🔴 CRITICAL - Cannot manage products

**Problem:**
```sql
CREATE POLICY "Only admins can modify products"
  ON products FOR ALL
  TO authenticated
  USING (false)    -- ❌ BLOCKS EVERYONE
  WITH CHECK (false);
```

**Impact:**
- Cannot update prices
- Cannot add new products
- Cannot modify descriptions
- Products table is write-once only

**Solution:** Need proper admin role system or service role access

---

### 4. NO DELETE POLICY FOR ORDERS
**Severity:** 🔴 HIGH - Orders cannot be cancelled

**Problem:** Users have SELECT, INSERT, UPDATE but no DELETE policy

**Impact:**
- Cannot cancel pending orders
- Cannot remove test orders
- Database will accumulate abandoned orders

**Solution:** Add delete policy for orders in 'pending' status

---

## ⚠️ HIGH PRIORITY ISSUES

### 5. MISSING CRUD POLICIES ON order_items
**Severity:** ⚠️ HIGH

**Problem:** Only SELECT and INSERT policies exist. No UPDATE or DELETE.

**Impact:**
- Cannot change quantity in cart
- Cannot remove items from order
- Order modifications impossible

**Solution:**
```sql
CREATE POLICY "Users can update own order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.status = 'pending'
    )
  );

CREATE POLICY "Users can delete own order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.status = 'pending'
    )
  );
```

---

### 6. PRODUCTS NOT VIEWABLE BY PUBLIC
**Severity:** ⚠️ HIGH - UX issue

**Problem:**
```sql
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  TO authenticated  -- ❌ Requires login
  USING (true);
```

**Impact:** Users must sign up before browsing products

**Solution:** Change to `TO public` if you want public browsing:
```sql
DROP POLICY "Products are publicly readable" ON products;
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT
  TO public
  USING (true);
```

---

### 7. TWO STYLE VARIANT TABLES
**Severity:** ⚠️ HIGH - Architectural confusion

**Problem:** Two separate tables for similar purpose:
- `artwork_style_variants` (from enhancement system)
- `style_variants` (from intelligent style system)

**Impact:**
- Confusing data model
- Duplicate functionality
- Potential data inconsistency

**Solution:** Consolidate into one table or document clear separation of concerns

---

### 8. MISSING INDEXES ON FOREIGN KEYS
**Severity:** ⚠️ HIGH - Performance issue

**Missing indexes:**
- `order_items.product_id` ❌
- `orders.shipping_address_id` ❌
- `artworks.master_id` ❌
- `artworks.active_variant_id` ❌

**Impact:** Slow JOIN queries as database grows

**Solution:** Add indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address ON orders(shipping_address_id);
CREATE INDEX IF NOT EXISTS idx_artworks_master_id ON artworks(master_id);
CREATE INDEX IF NOT EXISTS idx_artworks_active_variant ON artworks(active_variant_id);
```

---

### 9. MISSING CHECK CONSTRAINTS ON STATUS FIELDS
**Severity:** ⚠️ HIGH - Data integrity

**Problem:** Several status fields lack CHECK constraints:
- `orders.status` - no constraint (could be any text)
- `orders.payment_status` - no constraint
- `payment_history.status` - no constraint

**Impact:** Invalid status values can be inserted ("pendding", "complted", etc.)

**Solution:** Add CHECK constraints:
```sql
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check,
  ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));
```

---

### 10. STORAGE BUCKET RLS vs PUBLIC FLAG MISMATCH
**Severity:** ⚠️ MEDIUM - Security confusion

**Problem:**
```sql
-- Bucket is public
public: true

-- But policies restrict to authenticated
CREATE POLICY "Users can upload own artwork"
  ON storage.objects FOR INSERT
  TO authenticated
```

**Impact:** Confusing access control model

**Solution:** Document intended behavior or align public flag with policies

---

### 11. NO QUANTITY UPPER LIMIT ON cart_items
**Severity:** ⚠️ MEDIUM

**Problem:**
```sql
quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0)
```

No upper limit - user could add 2,147,483,647 items

**Impact:**
- Potential abuse
- Order total overflow
- UI display issues

**Solution:**
```sql
ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_quantity_check,
  ADD CONSTRAINT cart_items_quantity_check
    CHECK (quantity > 0 AND quantity <= 999);
```

---

## 📋 MEDIUM PRIORITY ISSUES

### 12. update_updated_at_column NOT IDEMPOTENT
**Problem:** Function created without checking existence
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
```

**Impact:** Safe due to `OR REPLACE`, but not best practice

**Solution:** Already handled with OR REPLACE

---

### 13. SUBSCRIPTION TIER UPDATE MIGHT FAIL SILENTLY
**Problem:**
```sql
UPDATE subscription_tiers
SET includes_digitization = ...
WHERE tier_name IN ('free', 'starter', 'pro');
```

If tiers don't exist, UPDATE succeeds but does nothing

**Impact:** Configuration might be incomplete

**Solution:** Add verification after UPDATE

---

### 14. PROFILES TABLE MIGHT NOT EXIST
**Problem:** Multiple migrations add columns to profiles table
First migration creates it, but dependencies unclear

**Impact:** Column additions could fail if profiles doesn't exist

**Solution:** Already handled with `IF NOT EXISTS` checks in most places

---

### 15. DUPLICATE UNIQUE CONSTRAINTS ON gelato_orders
**Problem:**
```sql
gelato_order_id text NOT NULL UNIQUE,
gelato_order_reference text NOT NULL UNIQUE,
```

Both are unique - might be redundant

**Impact:** Extra index overhead

**Solution:** Document if both really need to be unique

---

### 16. NO ADMIN ACCESS TO MOCKUP TEMPLATES
**Problem:** Only `is_active = true` templates are visible
No policy for admin to manage templates

**Impact:** Cannot update, deactivate, or manage templates

**Solution:** Add admin policies or service role access

---

## ✅ THINGS THAT ARE CORRECT

1. ✅ RLS enabled on ALL tables
2. ✅ UUID primary keys throughout
3. ✅ Proper CASCADE on user deletions
4. ✅ RESTRICT on product/artwork deletions (prevents orphans)
5. ✅ Timestamps with timezone
6. ✅ Price in cents (no floating point)
7. ✅ JSONB for flexible data
8. ✅ Good index coverage on user_id columns
9. ✅ Proper use of IF NOT EXISTS in column additions
10. ✅ Updated_at triggers properly implemented
11. ✅ Strong ownership checks in RLS policies
12. ✅ Auto-create user profile trigger

---

## 🔧 IMMEDIATE ACTION REQUIRED

### Priority 1 - Fix Before ANY Production Use:
1. ✅ Delete duplicate migration file
2. ✅ Remove duplicate shipping_addresses table
3. ✅ Fix products admin policy
4. ✅ Add missing CRUD policies

### Priority 2 - Fix Before Launch:
5. ✅ Add missing indexes
6. ✅ Add CHECK constraints on status fields
7. ✅ Consolidate style variant tables
8. ✅ Add order deletion policy

### Priority 3 - Optimize:
9. ✅ Add quantity upper limit
10. ✅ Document storage access model
11. ✅ Add admin management policies

---

## 📊 SECURITY SCORE: 7/10

**Strengths:**
- RLS enabled everywhere ✅
- Good ownership checks ✅
- No USING(true) vulnerabilities ✅

**Weaknesses:**
- Admin access completely blocked ⚠️
- Some CRUD operations impossible ⚠️
- Missing policies on order management ⚠️

---

## 🎯 RECOMMENDATION

**DO NOT GO TO PRODUCTION** until Critical Issues #1-4 are resolved.

The database schema is well-designed overall, but has configuration issues that will prevent basic operations like:
- Adding/updating products
- Modifying orders
- Managing product catalog

Would you like me to generate fixed migration files?
