# 🔍 CRASH ANALYSIS - What Happened When You Tried to Save

Based on the code review, here's exactly what likely caused your crash.

---

## 💥 THE CRASH SCENARIO

**What you did:** Uploaded artwork, styled it, then clicked "Save"

**What happened:** App crashed or showed an error

**Why it crashed:** One of several possible database issues

---

## 🎯 MOST LIKELY CAUSES (in order of probability)

### 1. RLS Policy Blocked the Insert (80% probability)

**What the code tried to do:**
```typescript
// artworkService.ts line 133
await supabase.from('artworks').insert([{
  user_id: user.id,
  title: artwork.title,
  original_url: originalUrl,
  processed_url: processedUrl,
  thumbnail_url: thumbnailUrl,
  cloudinary_public_id: cloudinaryPublicId,
  // ...more fields
}])
```

**What went wrong:**
The `artworks` table has an INSERT policy:
```sql
CREATE POLICY "Users can create own artworks"
  ON artworks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

**Possible failure reasons:**
- ❌ You weren't authenticated (session expired)
- ❌ The `auth.uid()` didn't match `user_id` (session mismatch)
- ❌ The table doesn't exist (migrations not applied)

**Error you probably saw:**
```
Error: new row violates row-level security policy for table "artworks"
```
or
```
Error: permission denied for table artworks
```

---

### 2. Missing Column: cloudinary_public_id (15% probability)

**What the code tried to do:**
```typescript
cloudinary_public_id: cloudinaryPublicId, // line 141
```

**What went wrong:**
If migration `20251203180354_add_cloudinary_mockup_system.sql` wasn't applied, the `cloudinary_public_id` column doesn't exist in the `artworks` table.

**Error you probably saw:**
```
Error: column "cloudinary_public_id" of relation "artworks" does not exist
```

**How to check:**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'artworks' AND column_name = 'cloudinary_public_id';
```

If this returns 0 rows, the column is missing.

---

### 3. Second Insert Failed: artwork_style_variants (5% probability)

**What the code tried to do:**
```typescript
// artworkService.ts line 156
await supabase.from('artwork_style_variants').insert({
  artwork_id: data.id,
  style_type: 'original',
  generation_status: 'completed',
  file_url: processedUrl,
  is_downloadable: true,
  generation_parameters: {}
});
```

**What went wrong:**
Even if the first insert succeeded, the second one might fail if:
- ❌ Table `artwork_style_variants` doesn't exist
- ❌ RLS policy blocks the insert
- ❌ Foreign key constraint fails (artwork_id doesn't exist)

**Error you probably saw:**
```
Error: relation "artwork_style_variants" does not exist
```
or
```
Error: insert or update on table "artwork_style_variants" violates foreign key constraint
```

---

## 🔬 HOW TO DIAGNOSE YOUR SPECIFIC CRASH

### Method 1: Check Browser Console

1. Open your app
2. Press F12 to open Developer Tools
3. Go to **Console** tab
4. Try to save artwork again
5. Look for red errors

**Example error messages to look for:**
```
POST https://bhltnhutjgyzvbcsjitp.supabase.co/rest/v1/artworks 403
{"code":"42501","message":"new row violates row-level security policy"}
```

The error code tells us exactly what happened:
- `42501` = Permission denied (RLS issue)
- `42P01` = Table doesn't exist (migration issue)
- `42703` = Column doesn't exist (migration issue)
- `23503` = Foreign key violation (data issue)

---

### Method 2: Check Network Tab

1. Open Developer Tools (F12)
2. Go to **Network** tab
3. Try to save artwork again
4. Look for red/failed requests
5. Click on the failed request
6. Check **Response** tab for error details

---

### Method 3: Check Supabase Logs

1. Open Supabase Dashboard: https://bhltnhutjgyzvbcsjitp.supabase.co
2. Go to **Logs** → **Database** (left sidebar)
3. Look for recent errors
4. Should show exact query that failed

---

## 🛠️ HOW TO FIX BASED ON ERROR

### Fix for RLS Policy Error

**Error seen:**
```
"new row violates row-level security policy"
"permission denied for table"
```

**Solution:**
1. Verify you're logged in:
```typescript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
```

2. Check RLS policies exist:
```sql
SELECT * FROM pg_policies WHERE tablename = 'artworks';
```

3. If policies missing, re-run migration:
```sql
-- From 20251128055713_create_initial_schema.sql
CREATE POLICY "Users can create own artworks"
  ON artworks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

---

### Fix for Missing Column Error

**Error seen:**
```
column "cloudinary_public_id" of relation "artworks" does not exist
```

**Solution:**
Run the migration that adds it:
```sql
-- From 20251203180354_add_cloudinary_mockup_system.sql
ALTER TABLE artworks ADD COLUMN IF NOT EXISTS cloudinary_public_id text;
```

Or run the entire migration file.

---

### Fix for Missing Table Error

**Error seen:**
```
relation "artworks" does not exist
relation "artwork_style_variants" does not exist
```

**Solution:**
Run ALL migrations in order. They haven't been applied to your database.

1. Go to Supabase SQL Editor
2. Run each file in `supabase/migrations/` in filename order
3. Start with `20251128055713_create_initial_schema.sql`
4. Continue through all 10 migration files

---

## 🔍 VERIFICATION SCRIPT

Run this to see exactly what's wrong:

```sql
-- Check if artworks table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'artworks'
) as artworks_exists;

-- Check if cloudinary_public_id column exists
SELECT EXISTS (
  SELECT FROM information_schema.columns
  WHERE table_schema = 'public'
  AND table_name = 'artworks'
  AND column_name = 'cloudinary_public_id'
) as column_exists;

-- Check if you have INSERT policy
SELECT COUNT(*) as insert_policy_count
FROM pg_policies
WHERE tablename = 'artworks' AND cmd = 'INSERT';

-- Check if artwork_style_variants exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'artwork_style_variants'
) as style_variants_exists;
```

**Expected results:**
```
artworks_exists: true
column_exists: true
insert_policy_count: 1
style_variants_exists: true
```

If any are false/0, that's your problem.

---

## 🎯 QUICK DIAGNOSTIC CHECKLIST

Run through these checks:

**Check 1: Can you query artworks?**
```sql
SELECT * FROM artworks LIMIT 1;
```
- ✅ Works → Table exists
- ❌ Fails → Migrations not applied

**Check 2: Can you insert a test row?**
```sql
-- As authenticated user
INSERT INTO artworks (
  user_id,
  title,
  original_url,
  processed_url,
  thumbnail_url,
  medium,
  subject,
  style,
  background_color,
  signature
) VALUES (
  auth.uid(),
  'Test',
  'http://test.com/1.jpg',
  'http://test.com/2.jpg',
  'http://test.com/3.jpg',
  'Test',
  'Test',
  'Original',
  '#FFFFFF',
  '{"text":"Test","descriptor":"","year":"2025"}'::jsonb
);
```
- ✅ Works → RLS policies OK
- ❌ Fails → RLS policy issue or auth issue

**Check 3: Does the column exist?**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'artworks' AND column_name = 'cloudinary_public_id';
```
- ✅ Returns 1 row → Column exists
- ❌ Returns 0 rows → Need to run migration

---

## 💡 MOST LIKELY SOLUTION

Based on the code and migrations, here's what probably happened:

1. **You ran some migrations but not all of them**
   - The initial tables exist
   - But later columns like `cloudinary_public_id` are missing

2. **Your session might have expired during save**
   - Auth check passes initially
   - But by the time insert happens, session is gone
   - RLS policy blocks the insert

**Fix:**
1. Run `verify-database.sql` to see what's missing
2. Run `fix-database-issues.sql` to fix policies
3. Re-run any missing migrations
4. Try saving again

---

## 🚀 STEP-BY-STEP RECOVERY

### Step 1: Verify Database State
```sql
-- Run verify-database.sql in Supabase SQL Editor
-- Save the output
```

### Step 2: Apply Fixes
```sql
-- Run fix-database-issues.sql
-- This fixes RLS policies
```

### Step 3: Check for Missing Migrations
```sql
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;
-- Should return 10
-- If less, run missing migration files
```

### Step 4: Test Insert Manually
```sql
-- Try inserting a test artwork
-- If it works, the app should work too
```

### Step 5: Try App Again
```bash
npm run dev
# Try the save operation again
# Check browser console for any new errors
```

---

## 📊 SUMMARY

**Most likely cause:** RLS policy issue or missing migration

**Most likely error:** "new row violates row-level security policy"

**Quickest fix:** Run `verify-database.sql` then `fix-database-issues.sql`

**Verification:** Try manual insert in SQL Editor - if it works, app will work

---

**Next step:** Run the verification script and share the error message you're seeing (from browser console or Supabase logs).
