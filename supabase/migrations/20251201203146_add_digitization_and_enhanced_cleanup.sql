/*
  # Enhanced Artwork Processing with Digitization

  ## Overview
  This migration adds support for multi-stage background cleanup and premium digitization features.

  ## 1. New Columns - Artworks Table
  
  ### Background Cleanup Tracking
    - `cleanup_level` (text): Tracks cleanup intensity - 'basic', 'aggressive', or 'custom'
    - `artifacts_detected` (boolean): Whether background artifacts were detected after initial cleanup
    - `perspective_corrected` (boolean): Whether perspective correction was applied
    - `secondary_cleanup_applied` (boolean): Whether user chose aggressive cleanup
  
  ### Digitization System
    - `digitization_enabled` (boolean): Whether user enabled digitization for this artwork
    - `digitized_url` (text): URL to the clean digital recreation
    - `digitization_fidelity_score` (numeric): SSIM score measuring how closely digitized matches original (0.0-1.0)
    - `digitization_failed` (boolean): Whether digitization was attempted but failed validation
    - `digitization_fallback_reason` (text): Explanation if digitization failed

  ## 2. Updated Tables - Subscription Tiers
  
  ### Premium Digitization Feature
    - `includes_digitization` (boolean): Whether this tier includes free digitization
    - `digitization_credit_cost` (integer): Cost in credits for pay-per-use digitization (if not included)

  ## 3. Updated Constraints - Credit Transactions
  
  ### New Transaction Type
    - Add 'digitization' to valid transaction types for tracking digitization purchases

  ## 4. Security
    - All columns added to existing tables with RLS already enabled
    - No new policy changes needed - existing policies cover new columns
*/

-- Add enhanced cleanup and digitization columns to artworks table
DO $$
BEGIN
  -- Background cleanup tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'cleanup_level'
  ) THEN
    ALTER TABLE artworks ADD COLUMN cleanup_level text DEFAULT 'basic' CHECK (cleanup_level IN ('basic', 'aggressive', 'custom'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'artifacts_detected'
  ) THEN
    ALTER TABLE artworks ADD COLUMN artifacts_detected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'perspective_corrected'
  ) THEN
    ALTER TABLE artworks ADD COLUMN perspective_corrected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'secondary_cleanup_applied'
  ) THEN
    ALTER TABLE artworks ADD COLUMN secondary_cleanup_applied boolean DEFAULT false;
  END IF;

  -- Digitization system
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_enabled'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitized_url'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitized_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_fidelity_score'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_fidelity_score numeric(4, 3) CHECK (digitization_fidelity_score >= 0 AND digitization_fidelity_score <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_failed'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_failed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'digitization_fallback_reason'
  ) THEN
    ALTER TABLE artworks ADD COLUMN digitization_fallback_reason text;
  END IF;
END $$;

-- Add digitization feature flags to subscription_tiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'includes_digitization'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN includes_digitization boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_tiers' AND column_name = 'digitization_credit_cost'
  ) THEN
    ALTER TABLE subscription_tiers ADD COLUMN digitization_credit_cost integer DEFAULT 2;
  END IF;
END $$;

-- Update existing tiers with digitization settings
UPDATE subscription_tiers
SET 
  includes_digitization = CASE 
    WHEN tier_name = 'free' THEN false
    WHEN tier_name = 'starter' THEN true
    WHEN tier_name = 'pro' THEN true
    ELSE false
  END,
  digitization_credit_cost = 2
WHERE tier_name IN ('free', 'starter', 'pro');

-- Update credit_transactions to support digitization transaction type
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;
  
  -- Add new constraint with digitization type
  ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_transaction_type_check 
    CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus', 'subscription', 'digitization'));
END $$;
