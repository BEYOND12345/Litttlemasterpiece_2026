# Cloudinary Mockup System Setup Guide

## Step 1: Configure Cloudinary Credentials

Add your Cloudinary credentials to `.env`:

```bash
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_API_KEY=514217946254721
VITE_CLOUDINARY_API_SECRET=your_api_secret
```

## Step 2: Upload Your Mockup Photos

You've already uploaded your mockup photos! Make note of the **public_id** for each photo:

1. Go to https://console.cloudinary.com/console/media_library
2. Find each uploaded photo
3. Click on it to see the public_id (e.g., "mockups/frame_photo" or "frame_photo")

## Step 3: Update Database Templates

1. Open the file `update-mockup-templates.sql`
2. Replace the placeholder public IDs with your actual Cloudinary public IDs
3. Run this SQL in your Supabase SQL Editor

Example:
```sql
UPDATE mockup_templates
SET cloudinary_public_id = 'mockups/my_frame_photo'
WHERE name = 'Framed Art on Gallery Wall';
```

## Step 4: Configure Artwork Placement (Optional)

The `placement_config` determines where the artwork appears on each mockup photo. The default values work well, but you can customize them:

```sql
UPDATE mockup_templates
SET placement_config = '{
  "left": "50%",
  "top": "45%",
  "width": "60%",
  "height": "60%",
  "gravity": "center"
}'::jsonb
WHERE name = 'Framed Art on Gallery Wall';
```

### Placement Config Options:
- **left/top**: Position of artwork (pixels or percentage)
- **width/height**: Size of artwork overlay (percentage of base image)
- **gravity**: Anchor point (center, north, south, east, west, etc.)
- **rotation**: Degrees to rotate artwork (optional)
- **scale**: Additional scaling factor (optional)

### Example Configurations:

#### Frame on Wall:
```json
{
  "left": "50%",
  "top": "50%",
  "width": "70%",
  "height": "70%",
  "gravity": "center"
}
```

#### T-Shirt:
```json
{
  "left": "50%",
  "top": "45%",
  "width": "40%",
  "height": "40%",
  "gravity": "center"
}
```

#### Mug (curved surface):
```json
{
  "left": "50%",
  "top": "50%",
  "width": "45%",
  "height": "45%",
  "gravity": "center",
  "rotation": -5
}
```

## Step 5: Test the System

1. Create a test artwork in the app
2. Navigate to the product gallery
3. Watch as mockups generate automatically
4. Adjust placement_config if needed to better position artwork on your photos

## How It Works

1. **Upload**: When user creates artwork, it uploads to Cloudinary
2. **Lazy Generation**: When user views gallery, system generates mockups on-demand
3. **Caching**: Generated mockup URLs are saved in database for instant subsequent loads
4. **No API Waste**: Mockups only generate when actually needed

## Troubleshooting

### Mockup shows "Failed to load"
- Check that cloudinary_public_id exactly matches your photo name
- Verify your Cloudinary credentials in .env
- Check browser console for specific error messages

### Artwork appears too small/large
- Adjust the `width` and `height` in placement_config
- Values are percentages of the base mockup photo

### Artwork is off-center
- Adjust `left` and `top` values
- Use `gravity: "center"` for automatic centering

### Need to regenerate mockups
Click the "Retry" button on any failed mockup, or delete from database:
```sql
DELETE FROM artwork_mockups WHERE artwork_id = 'your_artwork_id';
```
They'll regenerate on next gallery view.
