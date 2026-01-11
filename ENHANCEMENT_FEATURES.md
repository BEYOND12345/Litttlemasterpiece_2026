# Artwork Enhancement System

This document describes the new AI-powered artwork enhancement system that transforms children's drawings into professional print-ready artwork with multiple style variants.

## Overview

The enhancement system provides:
- **Automatic background removal** (free for all users)
- **AI upscaling** to print-ready resolution (4000x4000px)
- **5 style variants** users can generate on-demand
- **Credit-based system** for premium features
- **High-resolution downloads** in multiple formats
- **Generation queue** for async processing

## Features

### 1. Background Removal

Automatically removes backgrounds from uploaded artwork using:
- **Primary**: Rembg library (free, client-side processing)
- **Fallback**: Remove.bg API (if configured)

The system stores both versions:
- `original_with_bg_url`: Original uploaded image
- `original_no_bg_url`: Background-removed version

### 2. AI Upscaling

Images are upscaled to print-ready resolution (4000x4000px minimum) using:
- **Primary**: Real-ESRGAN via Replicate API (best quality)
- **Fallback**: Canvas-based upscaling (no API needed)

### 3. Style Variants

Users can generate 5 different style variations:

#### Original Clean (Free)
- Background removed
- Upscaled to 4000x4000px
- Artifact removal
- Print-ready quality

#### Enhanced (1 credit)
- All Original features plus:
- Enhanced textures and grain
- Improved contrast
- Print effects simulation
- Professional finish

#### Monochrome (1 credit)
- Single color in varying tones
- Maintains depth and detail
- User-selectable ink color
- Elegant minimalist style

#### Duotone (1 credit)
- Two-color screen print effect
- AI-suggested complementary colors
- Bold graphic style
- High contrast

#### Primary Colors (1 credit)
- Reduced to 3 primary colors
- Simplified bold shapes
- Clean graphic design
- Limited color palette

### 4. Credit System

The system uses a credit-based freemium model:

#### Free Tier
- 1 credit (1 Original style variant)
- Background removal included
- Web resolution downloads (1500px)

#### Starter Tier ($9.99/month)
- 10 credits
- All 5 style variants
- Print resolution downloads (4000px)
- High-quality exports

#### Professional Tier ($29.99/month)
- Unlimited credits
- All features
- Ultra resolution downloads (8000px)
- Priority processing

### 5. Generation Queue

Asynchronous processing system that:
- Queues style generation requests
- Shows real-time progress
- Estimates wait time
- Allows cancellation
- Notifies on completion

### 6. Download System

Multi-format, multi-resolution downloads:

**Formats:**
- PNG (transparent background)
- JPG (white background)
- PDF (vector when possible)

**Resolutions:**
- Web: 1500×1500px (social media, web use)
- Print: 4000×4000px (most prints)
- Ultra: 8000×8000px (large format prints)

## Database Schema

### New Tables

#### `artwork_style_variants`
Stores different style versions of each artwork:
```sql
- id (uuid)
- artwork_id (uuid) FK -> artworks
- style_type (text) 'original' | 'enhanced' | 'monochrome' | 'duotone' | 'primary'
- file_url (text)
- thumbnail_url (text)
- width, height (integer)
- generation_status (text) 'pending' | 'processing' | 'completed' | 'failed'
- quality_score (numeric)
- ai_model_used (text)
- generation_parameters (jsonb)
- is_downloadable (boolean)
```

#### `subscription_tiers`
Defines subscription plans:
```sql
- id (uuid)
- tier_name (text) 'free' | 'starter' | 'pro'
- credits_included (integer)
- max_style_variants (integer)
- max_resolution (integer)
- allows_downloads (boolean)
- price_cents (integer)
```

#### `generation_queue`
Manages async AI generation jobs:
```sql
- id (uuid)
- user_id (uuid) FK -> auth.users
- artwork_id (uuid) FK -> artworks
- style_type (text)
- status (text) 'queued' | 'processing' | 'completed' | 'failed'
- queue_position (integer)
- started_at, completed_at (timestamptz)
- retry_count (integer)
```

#### `credit_transactions`
Tracks credit usage and purchases:
```sql
- id (uuid)
- user_id (uuid) FK -> auth.users
- amount (integer)
- transaction_type (text) 'purchase' | 'usage' | 'refund' | 'bonus'
- description (text)
- balance_after (integer)
```

## Environment Variables

Add these to your `.env` file:

```env
# Replicate API (Required for AI enhancement)
VITE_REPLICATE_API_KEY=your_replicate_api_key_here

# Remove.bg API (Optional fallback for background removal)
VITE_REMOVEBG_API_KEY=your_removebg_api_key_here
```

## Services

### `enhancementService.ts`
- `removeBackground()` - Removes image backgrounds
- `upscaleImage()` - AI upscaling to high resolution
- `generateStyleVariant()` - Creates styled versions
- `getImageDimensions()` - Gets image size info

### `creditsService.ts`
- `getUserCredits()` - Get user's credit balance
- `deductCredits()` - Deduct credits for usage
- `addCredits()` - Add credits (purchase, refund, bonus)
- `canGenerateStyle()` - Check if user can generate

### `styleVariantsService.ts`
- `getArtworkVariants()` - Get all variants for artwork
- `createStyleVariant()` - Create new variant
- `queueStyleGeneration()` - Queue generation job
- `processStyleGeneration()` - Process queued job
- `getUserGenerationQueue()` - Get user's queue

## Components

### `StyleSelector.tsx`
Main UI for selecting and generating style variants:
- Shows 5 style options
- Displays credit costs
- Shows generation status
- Handles locked features for free users

### `DownloadModal.tsx`
Download interface with format and resolution options:
- PNG/JPG/PDF format selection
- Web/Print/Ultra resolution options
- File size estimates
- One-click download

### `GenerationQueue.tsx`
Real-time queue status display:
- Shows active generations
- Queue position
- Estimated wait time
- Progress indicators
- Cancel option

### `ArtworkEnhancementPage.tsx`
Full-page enhancement workflow:
- Automatic background removal on load
- AI upscaling
- Style selector integration
- Queue tracking
- Download management

## Cost Structure

Using Replicate API with recommended models:

| Operation | Model | Cost per Image |
|-----------|-------|----------------|
| Background Removal | Rembg (local) | Free |
| Upscaling | Real-ESRGAN | ~$0.01 |
| Style Generation | SDXL | ~$0.01 |

**Total cost per full artwork** (5 variants): ~$0.05

With $9.99/month pricing for 10 artworks:
- Cost: $0.50
- Revenue: $9.99
- **Profit margin: 95%**

## Usage Example

```typescript
import { ArtworkEnhancementPage } from './components/ArtworkEnhancementPage';

// In your app:
<ArtworkEnhancementPage
  artwork={selectedArtwork}
  onBack={() => navigateToGallery()}
/>
```

## API Integration

### Replicate API Setup

1. Sign up at https://replicate.com
2. Get your API key from https://replicate.com/account/api-tokens
3. Add to `.env`: `VITE_REPLICATE_API_KEY=r8_...`

### Models Used

- **Background Removal**: Rembg (free, client-side)
- **Upscaling**: `nightmareai/real-esrgan` (Real-ESRGAN 4x)
- **Style Generation**: `stability-ai/sdxl` (Stable Diffusion XL)

## Security & RLS Policies

All tables have Row Level Security enabled:

```sql
-- Users can only access their own variants
CREATE POLICY "Users can view variants of their own artworks"
  ON artwork_style_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM artworks
      WHERE artworks.id = artwork_style_variants.artwork_id
      AND artworks.user_id = auth.uid()
    )
  );
```

## Future Enhancements

Potential improvements:
- **Batch generation**: Generate all 5 styles at once
- **Custom styles**: User-defined color palettes
- **AI suggestions**: Recommend best style per artwork
- **Email notifications**: Alert when generation complete
- **Stripe integration**: Automated subscription billing
- **Webhook processing**: Server-side generation handling
- **Quality scoring**: Automatic quality assessment
- **A/B testing**: Compare AI models for best results

## Troubleshooting

### Background removal not working
- Check if image has sufficient contrast
- Try re-uploading with better lighting
- Verify API keys if using Remove.bg

### Style generation failing
- Ensure Replicate API key is valid
- Check credit balance
- Verify image is under 10MB
- Check browser console for errors

### Slow generation times
- Queue position affects wait time
- Consider upgrading to priority tier
- Check internet connection
- Large images take longer to process

## Support

For issues or questions:
1. Check browser console for errors
2. Verify all environment variables are set
3. Ensure user has sufficient credits
4. Review Replicate API dashboard for quota
5. Check Supabase logs for database errors
