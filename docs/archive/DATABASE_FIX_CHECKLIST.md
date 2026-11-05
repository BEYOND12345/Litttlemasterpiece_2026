# DATABASE FIX CHECKLIST - STEP BY STEP

## ⚠️ CRITICAL: Complete ALL steps before going to production

---

## STEP 1: Review the Audit Report
**Time Required:** 10 minutes

- [ ] Read `DATABASE_AUDIT_REPORT.md`
- [ ] Understand all 20 issues identified
- [ ] Note which issues affect your use cases

---

## STEP 2: Clean Up Duplicate Migration Files
**Time Required:** 2 minutes

### Action Required:
```bash
# Delete the duplicate migration file
rm supabase/migrations/20251128210355_20251128055713_create_initial_schema.sql
```

### Verification:
```bash
# You should see only ONE file with "create_initial_schema" in the name
ls -la supabase/migrations/ | grep "create_initial_schema"
```

**Expected result:** Only `20251128055713_create_initial_schema.sql` should exist

---

## STEP 3: Apply Critical Fixes to Database
**Time Required:** 5 minutes

### Action Required:
1. Open your Supabase Dashboard
2. Go to SQL Editor
3. Copy the entire contents of `FIX_CRITICAL_ISSUES.sql`
4. Paste into SQL Editor
5. Click "Run"

### Verification Queries (run these after):

**Check Products Policies:**
```sql
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'products'
ORDER BY policyname;
```

**Expected:** Should see policies for service_role (not just the blocking policy)

**Check Orders Policies:**
```sql
SELECT policyname
FROM pg_policies
WHERE tablename = 'orders'
ORDER BY policyname;
```

**Expected:** Should include "Users can delete own pending orders"

**Check Indexes:**
```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%order_items_product_id%';
```

**Expected:** Should return `idx_order_items_product_id`

---

## STEP 4: Handle Duplicate shipping_addresses Table
**Time Required:** 5 minutes

### Current Situation:
The `shipping_addresses` table is defined in TWO migrations:
1. `20251128210427_20251128070000_add_extended_features.sql` (lines 98-134)
2. `20251129024443_20251129000000_add_ecommerce_tables.sql` (lines 92-120)

### Decision Required:
Choose ONE of these options:

#### Option A: Remove from Extended Features (RECOMMENDED)
The ecommerce version has more complete fields (includes phone).

**Action:**
1. Edit `supabase/migrations/20251128210427_20251128070000_add_extended_features.sql`
2. Delete lines 98-134 (the entire shipping_addresses table creation)
3. Keep the shipping_addresses in the ecommerce migration

#### Option B: Merge Both Versions
Keep the ecommerce version as-is (it's more complete).

### Verification:
```sql
-- Check which columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipping_addresses'
ORDER BY ordinal_position;
```

**Expected:** Should include `phone` column

---

## STEP 5: Address Style Variants Table Duplication
**Time Required:** 10 minutes (requires decision)

### Current Situation:
You have TWO tables for storing artwork variants:
1. `artwork_style_variants` - from enhancement system (AI generation tracking)
2. `style_variants` - from intelligent style system (style caching)

### Analysis:

**artwork_style_variants:**
- Tracks AI generation status
- Includes quality scores
- Used for async generation queue
- Fields: generation_status, quality_score, ai_model_used

**style_variants:**
- Stores cached style transformations
- Simpler structure
- Used for instant re-selection
- Fields: style_type, settings, processing_metadata

### Decision Required:

#### Option A: Keep Both (Document Separation)
**Use if:** These truly serve different purposes
- `artwork_style_variants` = AI-generated variations with quality tracking
- `style_variants` = Style filter caching system

**Action:** Add comments to both tables explaining the difference

#### Option B: Consolidate (Simplify)
**Use if:** They serve the same purpose

**Action:** Choose one table and migrate data

### My Recommendation: **Option A - Keep Both**
They appear to serve different purposes in your pipeline.

**Add this documentation:**
```sql
COMMENT ON TABLE artwork_style_variants IS 'AI-generated artwork variations with quality tracking and generation status';
COMMENT ON TABLE style_variants IS 'Cached style transformations for instant re-selection';
```

---

## STEP 6: Test Critical Operations
**Time Required:** 15 minutes

### Test 1: Product Management (Using Service Role)
```javascript
// This would be in a server-side function or edge function
const { data, error } = await supabase
  .from('products')
  .update({ price_cents: 9900 })
  .eq('type', 'framed')
  .select();

console.log('Product update:', data, error);
```

**Expected:** Should update successfully (not blocked)

---

### Test 2: Public Product Browsing (No Auth)
```javascript
// This can run without authentication
const { data, error } = await supabase
  .from('products')
  .select('*');

console.log('Public products:', data, error);
```

**Expected:** Should return products without requiring login

---

### Test 3: Order Deletion
```javascript
// As authenticated user
const { error } = await supabase
  .from('orders')
  .delete()
  .eq('id', orderId)
  .eq('status', 'pending');

console.log('Order deletion:', error);
```

**Expected:** Should delete pending orders successfully

---

### Test 4: Cart Item Modification
```javascript
// Update quantity in cart
const { error } = await supabase
  .from('cart_items')
  .update({ quantity: 3 })
  .eq('id', cartItemId);

console.log('Cart update:', error);
```

**Expected:** Should update successfully

---

### Test 5: Order Item Removal
```javascript
// Remove item from pending order
const { error } = await supabase
  .from('order_items')
  .delete()
  .eq('id', orderItemId);

console.log('Order item deletion:', error);
```

**Expected:** Should delete successfully (only for pending orders)

---

## STEP 7: Add Additional Constraints (Optional but Recommended)
**Time Required:** 5 minutes

### These add extra data safety:

```sql
-- Prevent negative prices
ALTER TABLE products
  ADD CONSTRAINT products_price_positive
  CHECK (price_cents >= 0);

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_price_positive
  CHECK (price_cents >= 0);

-- Prevent negative order totals
ALTER TABLE orders
  ADD CONSTRAINT orders_total_positive
  CHECK (total_cents >= 0);

-- Ensure dates are logical
ALTER TABLE orders
  ADD CONSTRAINT orders_dates_logical
  CHECK (updated_at >= created_at);

-- Ensure dimensions are positive
ALTER TABLE artworks
  ADD CONSTRAINT artworks_dimensions_positive
  CHECK (
    (original_width IS NULL OR original_width > 0)
    AND (original_height IS NULL OR original_height > 0)
  );
```

---

## STEP 8: Performance Baseline (Optional)
**Time Required:** 5 minutes

### Run these to establish baseline query performance:

```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Check index usage (run this after app has some usage)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Identify slow queries (enable pg_stat_statements first)
SELECT
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE query LIKE '%public%'
ORDER BY mean_time DESC
LIMIT 10;
```

---

## STEP 9: Update Application Code
**Time Required:** Variable

### Changes needed in your codebase:

1. **Product Management:**
   - Ensure product CRUD uses service role key (server-side only)
   - Never expose service role key to client

2. **Order Cancellation:**
   - Add "Cancel Order" button for pending orders
   - Update UI to support order deletion

3. **Cart Modifications:**
   - Enable quantity adjustment in cart
   - Add remove item functionality

4. **Public Product Browsing:**
   - Products can now load without authentication
   - Update landing page to show products before signup

---

## STEP 10: Final Verification Checklist

Before considering the database production-ready, verify:

- [ ] No duplicate migration files exist
- [ ] FIX_CRITICAL_ISSUES.sql ran without errors
- [ ] Products can be updated via service role
- [ ] Products visible without login
- [ ] Orders can be deleted (pending status only)
- [ ] Order items can be updated and deleted
- [ ] Cart items quantity can be modified
- [ ] All indexes created successfully
- [ ] Status CHECK constraints working
- [ ] Quantity limits enforced (max 999)
- [ ] All RLS policies tested with actual user

---

## SUMMARY OF CHANGES MADE

### Security Changes:
✅ Products now have proper service role access
✅ Public can browse products before signup
✅ Users can cancel pending orders
✅ Users can modify cart and order items

### Data Integrity Changes:
✅ Status fields now validated with CHECK constraints
✅ Quantity limits enforced (1-999)
✅ Missing indexes added for performance
✅ Foreign key indexes created

### Schema Changes:
✅ Duplicate migration removed
✅ Duplicate table definition resolved
✅ Style variant tables documented

---

## ESTIMATED TOTAL TIME: 60-90 minutes

## PRIORITY:
🔴 **MUST COMPLETE BEFORE PRODUCTION LAUNCH**

This is not optional. The database will not function properly for:
- Product management
- Order processing
- Shopping cart
- Public browsing

---

## NEED HELP?

If you encounter any errors:
1. Copy the exact error message
2. Note which step you were on
3. Check the verification queries
4. Review the audit report for context

---

## AFTER COMPLETION:

✅ Database will be production-ready
✅ All CRUD operations will work
✅ Performance optimized
✅ Security properly configured
✅ Data integrity enforced

Good luck! 🚀
