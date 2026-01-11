# ⚡ Quick Start - Fresh Database Setup

**Total Time: 15 minutes**

---

## Step 1: Create Supabase Project (3 min)
1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose name, password, region
4. Wait for creation (~2 minutes)

---

## Step 2: Get API Keys (1 min)
1. Settings → API
2. Copy:
   - Project URL
   - anon public key
   - service_role key

---

## Step 3: Update .env (1 min)
```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Step 4: Run Migrations (5 min)
1. Open **SQL Editor** in Supabase
2. Run each file from `supabase/migrations/` in order:
   - ✅ `20251128055713_create_initial_schema.sql`
   - ✅ `20251128210427_20251128070000_add_extended_features.sql`
   - ✅ `20251128211539_20251128220000_create_storage_bucket.sql`
   - ✅ `20251128215944_20251128230000_auto_create_user_profile.sql`
   - ✅ `20251129024443_20251129000000_add_ecommerce_tables.sql`
   - ✅ `20251129031853_add_gelato_template_ids.sql`
   - ✅ `20251129032958_add_artwork_enhancement_system.sql`
   - ✅ `20251201203146_add_digitization_and_enhanced_cleanup.sql`
   - ✅ `20251202050637_add_intelligent_style_processing.sql`
   - ✅ `20251203180354_add_cloudinary_mockup_system.sql`

---

## Step 5: (Optional) Seed Data (2 min)
Run `seed-products.sql` to add sample products

---

## Step 6: Test (1 min)
```bash
npm run dev
```
- Sign up / Login
- View products
- Add to cart

---

## ✅ Done!

**See `FRESH_SETUP_GUIDE.md` for detailed instructions and troubleshooting.**
