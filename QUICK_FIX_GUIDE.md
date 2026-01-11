# ⚡ QUICK FIX GUIDE - Get Your App Working in 5 Minutes

## The Problem
Database RLS policies are blocking cart operations and product browsing.

## The Solution
Run one SQL file in Supabase.

---

## 🎯 DO THIS NOW

### 1. Open Supabase (1 min)
- Go to: https://bhltnhutjgyzvbcsjitp.supabase.co
- Click **"SQL Editor"** (left sidebar)
- Click **"New Query"**

### 2. Run the Fix (2 min)
- Open file: **`APPLY_THIS_FIX.sql`**
- Copy everything (Ctrl+A, Ctrl+C)
- Paste into SQL Editor
- Click **"Run"** or press Ctrl+Enter
- Wait for "Success" ✅

### 3. Test Your App (2 min)
```bash
npm run dev
```
- Sign in
- Try browsing products (should work now)
- Try adding to cart (should work now)
- Try saving artwork (should work now)

---

## ✅ Success Looks Like This

**In SQL Editor after running:**
```
=== ✅ DATABASE FIXES APPLIED ===

table_name    | policy_count
--------------|-------------
products      | 2
cart_items    | 4
order_items   | 6
```

**In your app:**
- Products page loads ✅
- Add to Cart button works ✅
- Cart sidebar opens ✅
- No console errors ✅

---

## ❌ If Something Goes Wrong

### "relation already exists"
→ **Ignore it.** That's fine, the fix is idempotent.

### "policy already exists"
→ **Ignore it.** Also fine, prevents duplicates.

### App still broken after fix?
1. Refresh page (Ctrl+Shift+R)
2. Check you're signed in
3. Open browser console (F12) for errors
4. Read `CRASH_ANALYSIS.md` for specific error diagnosis

---

## 📚 Other Helpful Files

**If you want to understand WHY:**
- `START_HERE.md` - Complete overview
- `DATABASE_REVIEW.md` - Detailed database diagnosis
- `CRASH_ANALYSIS.md` - Error-specific fixes
- `FIXES_APPLIED.md` - Detailed explanation of the fix

**If fix doesn't work:**
- `verify-database.sql` - Check database state
- `CRASH_ANALYSIS.md` - Diagnose specific errors

**If you want to start fresh:**
- `FRESH_SETUP_GUIDE.md` - New Supabase project setup

---

## 🎯 One-Line Summary

**Run `APPLY_THIS_FIX.sql` in Supabase SQL Editor, then test your app.**

That's it! 🚀
