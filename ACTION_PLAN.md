# 🎯 ACTION PLAN - Fix Project in Priority Order

**Goal:** Get app working end-to-end
**Time Required:** 12-16 hours
**Current Blockers:** 4 critical database/code issues

---

## 🔥 PHASE 1: CRITICAL FIXES (1-2 hours)

### Task 1.1: Fix Database RLS Policies
**Time:** 30 minutes
**Blocker:** Orders, cart, products all broken

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Run this script:

```sql
-- Fix 1: Allow nested shipping address queries
DROP POLICY IF EXISTS "Users can view own shipping addresses" ON shipping_addresses;

CREATE POLICY "Users can view own shipping addresses"
  ON shipping_addresses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.shipping_address_id = shipping_addresses.id
      AND orders.user_id = auth.uid()
    )
  );

-- Fix 2: Allow product management
CREATE POLICY IF NOT EXISTS "Service role can manage products"
  ON products FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix 3: Allow users to modify their cart
CREATE POLICY IF NOT EXISTS "Users can update own order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
      AND orders.status = 'pending'
    )
  );

CREATE POLICY IF NOT EXISTS "Users can delete own order items"
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

-- Fix 4: Allow users to cancel pending orders
CREATE POLICY IF NOT EXISTS "Users can delete own pending orders"
  ON orders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');
```

3. Verify it worked:
```sql
-- Should return at least 4 policies
SELECT policyname FROM pg_policies WHERE tablename = 'order_items';
```

---

### Task 1.2: Fix CartContext
**Time:** 30 minutes
**Blocker:** Cannot add items to cart

**File:** `src/contexts/CartContext.tsx`

**Add this method:**
```typescript
const addItem = async (
  artworkId: string,
  productVariantId: string,
  quantity: number = 1
) => {
  if (!user) throw new Error('Must be logged in');

  // Check if item already in cart
  const existing = items.find(
    item => item.artworkId === artworkId && item.productVariantId === productVariantId
  );

  if (existing) {
    await updateQuantity(existing.id, existing.quantity + quantity);
    return;
  }

  // Get product details for price
  const { data: variant } = await supabase
    .from('product_variants')
    .select('*, product:products(*)')
    .eq('id', productVariantId)
    .single();

  if (!variant) throw new Error('Product not found');

  // Insert into database
  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      user_id: user.id,
      artwork_id: artworkId,
      product_variant_id: productVariantId,
      quantity,
      price_cents: variant.price_cents
    })
    .select()
    .single();

  if (error) throw error;

  setItems([...items, data]);
};
```

**Update the context value:**
```typescript
return (
  <CartContext.Provider value={{
    items,
    addItem,      // ← Add this
    removeItem,
    updateQuantity,
    clearCart,
    totalCents,
  }}>
    {children}
  </CartContext.Provider>
);
```

---

### Task 1.3: Create cart_items Table (if missing)
**Time:** 15 minutes

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'cart_items'
);

-- If false, create it:
CREATE TABLE cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  artwork_id uuid REFERENCES artworks(id) ON DELETE CASCADE NOT NULL,
  product_variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
```

---

### Task 1.4: Verify Database Migrations Applied
**Time:** 15 minutes

```sql
-- Check which migrations have run
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

-- Check if critical columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('payment_status', 'shipping_address_id', 'gelato_order_id');

-- Should return 3 rows. If missing any, need to apply migrations.
```

---

## 🟡 PHASE 2: DATA ALIGNMENT (2-3 hours)

### Task 2.1: Clean Up Duplicate Migrations
**Time:** 30 minutes

```bash
# Check for duplicates
ls -la supabase/migrations/

# Look for files with same content
# Delete any duplicates (but keep one copy!)
```

---

### Task 2.2: Add Missing Columns
**Time:** 1 hour

Run this to see what's missing:
```sql
-- Check orders table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
```

Expected columns:
- id
- user_id
- total_cents
- status
- payment_status ← May be missing
- shipping_address_id ← May be missing
- gelato_order_id ← May be missing
- created_at
- updated_at

If missing, add them:
```sql
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS shipping_address_id uuid REFERENCES shipping_addresses(id),
ADD COLUMN IF NOT EXISTS gelato_order_id text;
```

---

### Task 2.3: Seed Test Products
**Time:** 30 minutes

```sql
-- Check if products exist
SELECT count(*) FROM products;

-- If 0, add some:
INSERT INTO products (name, type, description, price_cents) VALUES
('Framed Print 8x10', 'framed', 'Professional framed print', 2999),
('Tote Bag', 'tote', 'Canvas tote bag', 1999),
('Canvas Print 12x16', 'canvas', 'Gallery wrapped canvas', 4999),
('Coffee Mug', 'mug', 'Ceramic mug 11oz', 1499)
ON CONFLICT DO NOTHING;

-- Add variants
INSERT INTO product_variants (product_id, name, size, color, price_cents, is_available)
SELECT
  id,
  name || ' - Standard',
  'Standard',
  'White',
  price_cents,
  true
FROM products
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants WHERE product_id = products.id
);
```

---

### Task 2.4: Test Database Connection
**Time:** 30 minutes

Create test file: `test-db.ts`
```typescript
import { supabase } from './src/services/supabaseClient';

async function testDatabase() {
  // Test 1: Auth works
  const { data: { user } } = await supabase.auth.getUser();
  console.log('✅ Auth:', user ? 'Connected' : 'Not logged in');

  // Test 2: Products readable
  const { data: products, error: pError } = await supabase
    .from('products')
    .select('*')
    .limit(1);
  console.log('✅ Products:', products ? 'Readable' : 'Error: ' + pError?.message);

  // Test 3: Cart operations
  if (user) {
    const { error: cError } = await supabase
      .from('cart_items')
      .select('*')
      .limit(1);
    console.log('✅ Cart:', cError ? 'Error: ' + cError.message : 'Readable');
  }
}

testDatabase();
```

Run it:
```bash
npx tsx test-db.ts
```

---

## 🔵 PHASE 3: CODE CLEANUP (2-3 hours)

### Task 3.1: Fix All TypeScript Errors
**Time:** 2 hours

```bash
npm run typecheck
```

Fix each error one by one:
1. Remove unused imports
2. Fix type mismatches
3. Add missing properties
4. Remove dead code

---

### Task 3.2: Remove Fake Data Files
**Time:** 30 minutes

```bash
# If not using fake data anymore:
rm src/utils/fakeDb.ts
rm src/utils/fakeApi.ts

# Then fix any imports that reference them
```

---

## 🟢 PHASE 4: TESTING (3-4 hours)

### Task 4.1: Manual User Flow Test
**Time:** 1 hour

Test this sequence:
1. ✅ Sign up new user
2. ✅ Upload artwork
3. ✅ Apply style (monochrome, duotone)
4. ✅ View mockups
5. ✅ Add to cart
6. ✅ Update cart quantity
7. ✅ Checkout (test mode)
8. ✅ View order history

Document any failures.

---

### Task 4.2: Edge Case Testing
**Time:** 1 hour

Test failure modes:
- Upload invalid file
- Exceed file size limit
- Network timeout during processing
- Cancel order
- Remove all cart items
- Try to access someone else's artwork

---

### Task 4.3: Performance Testing
**Time:** 1 hour

Test with:
- Large images (10MB+)
- Many cart items (20+)
- Complex mockups
- Slow network (throttle to 3G)

---

### Task 4.4: Security Audit
**Time:** 1 hour

Verify:
- Can't access other users' data
- Can't modify other users' orders
- Image uploads are validated
- SQL injection not possible
- XSS not possible in user inputs

---

## 📊 PROGRESS CHECKLIST

### Phase 1: Critical ⏳
- [ ] RLS policies fixed
- [ ] CartContext has addItem
- [ ] cart_items table exists
- [ ] Migrations verified

### Phase 2: Alignment ⏳
- [ ] Duplicates removed
- [ ] Missing columns added
- [ ] Products seeded
- [ ] Connection tested

### Phase 3: Cleanup ⏳
- [ ] TypeScript errors fixed
- [ ] Fake data removed

### Phase 4: Testing ⏳
- [ ] User flow works end-to-end
- [ ] Edge cases handled
- [ ] Performance acceptable
- [ ] Security verified

---

## 🚦 STATUS INDICATORS

**🔴 Blocked** - Can't proceed without this
**🟡 In Progress** - Currently working on
**🟢 Complete** - Done and verified

---

## 💡 TIPS

1. **Work in order** - Don't skip ahead
2. **Test after each task** - Catch issues early
3. **Commit often** - So you can roll back
4. **Document problems** - For future reference
5. **Take breaks** - Fresh eyes catch bugs

---

## 🆘 IF STUCK

### Issue: "RLS policy still failing"
**Check:**
- Are you logged in as the right user?
- Did you refresh your auth token?
- Is the table name spelled correctly?

### Issue: "Column doesn't exist"
**Check:**
- Did migration actually run?
- Check: `SELECT * FROM supabase_migrations.schema_migrations`
- Check: `\d tablename` in SQL editor

### Issue: "Can't find table"
**Check:**
- Is RLS enabled?
- Do you have SELECT policy?
- Are you using the right schema (public)?

---

**Start Here:** Begin with Phase 1, Task 1.1 ☝️
