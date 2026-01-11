-- Update mockup template public IDs with the correct ones from Cloudinary
--
-- Instructions:
-- 1. In Cloudinary, click on each mockup image in the mockups folder
-- 2. Copy the exact "Public ID" shown (it might be just the filename or include "mockups/" prefix)
-- 3. Replace the placeholder values below with the actual public IDs
-- 4. Run this SQL in your Supabase SQL editor

-- Phone Case Mockup
UPDATE mockup_templates
SET cloudinary_public_id = 'REPLACE_WITH_ACTUAL_PUBLIC_ID'
WHERE name = 'Phone Case Display';

-- Tote Bag Mockup
UPDATE mockup_templates
SET cloudinary_public_id = 'REPLACE_WITH_ACTUAL_PUBLIC_ID'
WHERE name = 'Tote Bag on Table';

-- Framed Art Mockup
UPDATE mockup_templates
SET cloudinary_public_id = 'REPLACE_WITH_ACTUAL_PUBLIC_ID'
WHERE name = 'Framed Art on Gallery Wall';

-- Verify the updates
SELECT id, name, cloudinary_public_id
FROM mockup_templates
WHERE is_active = true
ORDER BY name;
