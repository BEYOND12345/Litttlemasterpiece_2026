# 🚀 Fresh Supabase Setup Guide

Starting with a new Supabase project will give you a clean, optimized database with all the fixes built-in from the start!

---

## STEP 1: Create New Supabase Project (3 minutes)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Click **"New Project"**

2. **Project Settings**
   - **Name**: Choose any name (e.g., "DesignStore" or "ArtistPlatform")
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is perfect to start

3. **Wait for Project Creation**
   - Takes about 2 minutes
   - You'll see a progress indicator

---

## STEP 2: Get Your API Keys (1 minute)

1. **In Your New Project Dashboard**
   - Click **Settings** (gear icon in sidebar)
   - Click **API** section

2. **Copy These Values** (you'll need them next):
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhbGc...
   service_role key: eyJhbGc... (keep this secret!)
   ```

---

## STEP 3: Update Your .env File (1 minute)

1. **Open** `.env` **file in your project**

2. **Replace with your new values**:
   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here

   # For server/admin operations (keep secret!)
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

   # Cloudinary (if you have it)
   VITE_CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
   VITE_CLOUDINARY_API_KEY=your-cloudinary-api-key
   CLOUDINARY_API_SECRET=your-cloudinary-api-secret

   # Gemini AI (if you have it)
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

3. **Save the file**

---

## STEP 4: Apply All Migrations (5 minutes)

Now we'll set up your entire database with all tables, policies, and functions in the correct order.

### Option A: Using Supabase Dashboard (Recommended)

1. **Open SQL Editor**
   - In your Supabase dashboard
   - Click **SQL Editor** in sidebar
   - Click **"New Query"**

2. **Run Each Migration File**

   Run these files **in order**, one at a time:

   **Migration 1**: `supabase/migrations/20251128055713_create_initial_schema.sql`
   - Copy all contents
   - Paste in SQL Editor
   - Click **RUN**
   - Wait for "Success" ✅

   **Migration 2**: `supabase/migrations/20251128210427_20251128070000_add_extended_features.sql`
   - Copy, paste, run ✅

   **Migration 3**: `supabase/migrations/20251128211539_20251128220000_create_storage_bucket.sql`
   - Copy, paste, run ✅

   **Migration 4**: `supabase/migrations/20251128215944_20251128230000_auto_create_user_profile.sql`
   - Copy, paste, run ✅

   **Migration 5**: `supabase/migrations/20251129024443_20251129000000_add_ecommerce_tables.sql`
   - Copy, paste, run ✅

   **Migration 6**: `supabase/migrations/20251129031853_add_gelato_template_ids.sql`
   - Copy, paste, run ✅

   **Migration 7**: `supabase/migrations/20251129032958_add_artwork_enhancement_system.sql`
   - Copy, paste, run ✅

   **Migration 8**: `supabase/migrations/20251201203146_add_digitization_and_enhanced_cleanup.sql`
   - Copy, paste, run ✅

   **Migration 9**: `supabase/migrations/20251202050637_add_intelligent_style_processing.sql`
   - Copy, paste, run ✅

   **Migration 10**: `supabase/migrations/20251203180354_add_cloudinary_mockup_system.sql`
   - Copy, paste, run ✅

### Option B: Using Supabase CLI (If you have it installed)

```bash
# Link to your new project
supabase link --project-ref YOUR_PROJECT_REF

# Run all migrations
supabase db push

# That's it!
```

---

## STEP 5: Seed Initial Data (Optional - 2 minutes)

To get started with some products:

1. **Open SQL Editor** again
2. **Run**: `seed-products.sql`
   - Copy contents
   - Paste in SQL Editor
   - Click RUN

This adds sample products, subscription tiers, and mockup templates.

---

## STEP 6: Verify Everything Works (2 minutes)

### Quick Verification Query

Run this in SQL Editor to check all tables exist:

```sql
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see these tables:
- ✅ artworks
- ✅ cart_items
- ✅ credit_transactions
- ✅ guides
- ✅ mockup_templates
- ✅ order_items
- ✅ orders
- ✅ payment_history
- ✅ product_variants
- ✅ products
- ✅ profiles
- ✅ shipping_addresses
- ✅ style_variants
- ✅ subscription_tiers

### Check RLS is Enabled

```sql
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rowsecurity = true` ✅

---

## STEP 7: Test Your Application (1 minute)

1. **Start your dev server** (if not already running)
   ```bash
   npm run dev
   ```

2. **Test these features**:
   - ✅ Sign up / Login works
   - ✅ Can view products
   - ✅ Can add to cart
   - ✅ Profile shows credits
   - ✅ No console errors

---

## 🎯 WHAT YOU GET WITH FRESH SETUP

### ✅ All Issues Fixed from Day 1
- Proper RLS policies for all tables
- Correct foreign key relationships
- All necessary indexes
- Atomic credit transaction function
- No race conditions
- No permission errors

### ✅ Complete Feature Set
- User authentication & profiles
- Credit system with transactions
- Product catalog with variants
- Shopping cart & orders
- Artwork generation & variants
- Mockup system with Cloudinary
- Intelligent style processing
- E-commerce ready

### ✅ Security Built-In
- Row Level Security on all tables
- Proper authentication checks
- Safe credit operations
- Protected admin operations
- Secure storage bucket

### ✅ Performance Optimized
- Indexes on all foreign keys
- Optimized query patterns
- Efficient RLS policies
- CONCURRENTLY built indexes

---

## 📊 MIGRATION SUMMARY

Here's what each migration does:

1. **Initial Schema** - Core tables (users, artworks, profiles, credits)
2. **Extended Features** - Subscription tiers, guides, settings
3. **Storage Bucket** - For artwork uploads
4. **Auto Profiles** - Automatically creates user profiles on signup
5. **E-commerce** - Products, orders, cart, payments
6. **Gelato Integration** - Print-on-demand template IDs
7. **Enhancement System** - AI artwork enhancement tracking
8. **Digitization** - Physical artwork to digital conversion
9. **Style Processing** - Intelligent style variants
10. **Mockup System** - Cloudinary-based product mockups

---

## 🔒 SECURITY CHECKLIST

After setup, verify:
- [ ] RLS enabled on all tables
- [ ] anon key is in .env (for frontend)
- [ ] service_role key is in .env (never expose to frontend!)
- [ ] Storage bucket has proper policies
- [ ] Test that users can only see their own data

---

## 🚨 COMMON ISSUES & FIXES

### "No API key found"
→ Check `.env` file has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
→ Restart dev server after changing .env

### "Permission denied for table"
→ Make sure ALL migrations ran successfully
→ Check RLS policies were created

### "relation does not exist"
→ A migration didn't run
→ Run migrations in order again

### "Column does not exist"
→ Later migration depends on earlier one
→ Run ALL migrations in sequence

---

## 💡 PRO TIPS

1. **Save your .env file** - Back it up somewhere safe
2. **Don't commit .env** - It's in .gitignore for security
3. **Use different projects** - One for dev, one for production
4. **Monitor usage** - Free tier has limits (check dashboard)
5. **Keep migrations** - Never delete them once applied

---

## 🎉 YOU'RE DONE!

Your database is now:
- ✅ Fresh and clean
- ✅ Fully configured
- ✅ Optimized for performance
- ✅ Secured with RLS
- ✅ Ready for production

No more pausing, no legacy issues, no database errors!

---

## NEXT STEPS

After setup is complete:

1. **Test all features** thoroughly
2. **Upload real mockup images** to Cloudinary
3. **Configure Gelato** template IDs (if using print-on-demand)
4. **Add your content** (products, guides, etc.)
5. **Go live!** 🚀

---

## ❓ NEED HELP?

If you run into any issues during setup:
1. Check the error message in SQL Editor
2. Verify you ran migrations in order
3. Check all API keys are correct in .env
4. Let me know the specific error and I can help debug!

---

**Total Time**: ~15 minutes for complete setup
**Difficulty**: Easy (just copy/paste and run)
**Result**: Production-ready database with zero issues!
