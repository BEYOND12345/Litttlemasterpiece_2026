/*
  # Update Mockup Templates with Your Cloudinary Photo Public IDs

  Instructions:
  1. Replace the cloudinary_public_id values below with your actual photo names from Cloudinary
  2. The public_id should match exactly what you see in your Cloudinary console
  3. For example: 'mockups/frame_gallery_wall' or just 'frame_photo' depending on your folder structure
  4. Run this SQL in your Supabase SQL editor to update the templates

  Note: You can find your public IDs in your Cloudinary console at:
  https://console.cloudinary.com/console/media_library
*/

-- Update Frame Template
UPDATE mockup_templates
SET cloudinary_public_id = 'YOUR_FRAME_PHOTO_PUBLIC_ID_HERE'
WHERE name = 'Framed Art on Gallery Wall';

-- Update Canvas Template
UPDATE mockup_templates
SET cloudinary_public_id = 'YOUR_CANVAS_PHOTO_PUBLIC_ID_HERE'
WHERE name = 'Canvas on Wooden Shelf';

-- Update T-Shirt Template
UPDATE mockup_templates
SET cloudinary_public_id = 'YOUR_TSHIRT_PHOTO_PUBLIC_ID_HERE'
WHERE name = 'White T-Shirt Flatlay';

-- Update Mug Template
UPDATE mockup_templates
SET cloudinary_public_id = 'YOUR_MUG_PHOTO_PUBLIC_ID_HERE'
WHERE name = 'Ceramic Mug on Desk';

-- Verify the updates
SELECT id, name, cloudinary_public_id, product_type
FROM mockup_templates
ORDER BY display_order;
