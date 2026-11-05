# Gelato Integration Setup Guide

This guide explains how to set up Gelato's template-based mockup and order fulfillment system.

## Overview

The app uses Gelato's **template-based API** to:
- Generate realistic product mockups with customer artwork
- Submit print-on-demand orders for fulfillment
- Track order status and shipping

## Current Implementation

### Order Fulfillment ✅ **Ready**
Orders are automatically submitted to Gelato when customers checkout. This is already working!

### Mockup Generation ⚙️ **Requires Setup**
To generate real mockups via Gelato's API, you need to create product templates in your Gelato dashboard.

---

## Setup Steps

### 1. Get Your Gelato Store ID

1. Log into [Gelato Dashboard](https://dashboard.gelato.com)
2. Navigate to **Settings** → **API**
3. Copy your **Store ID**
4. Add to `.env`:
   ```
   VITE_GELATO_STORE_ID=your_store_id_here
   ```

### 2. Create Product Templates

For each product type (Frame, Canvas, Tote, Mug), create a template:

#### Steps:
1. Go to **Templates** in Gelato Dashboard
2. Click **Create New Template**
3. Select your product type (e.g., "Framed Poster")
4. Configure:
   - **Product variants** (sizes, materials)
   - **Print areas** with placeholder names (e.g., "artwork")
   - **Mockup settings**
5. Save and copy the **Template ID**

#### Required Templates:
- **Framed Print** → Template for frames (various sizes)
- **Canvas Print** → Template for canvas (various sizes)
- **Tote Bag** → Template for totes
- **Mug** → Template for mugs

### 3. Store Template IDs in Database

Update your products table with template IDs:

```sql
UPDATE products SET gelato_template_id = 'template-id-here' WHERE name = 'Framed Print';
UPDATE products SET gelato_template_id = 'template-id-here' WHERE name = 'Canvas Print';
UPDATE products SET gelato_template_id = 'template-id-here' WHERE name = 'Tote Bag';
UPDATE products SET gelato_template_id = 'template-id-here' WHERE name = 'Mug';
```

### 4. How It Works

Once templates are configured:

1. **Customer creates artwork** in Art Studio
2. **Selects a product** from MockupGallery
3. **API creates product from template:**
   ```typescript
   createProductFromTemplate(
     storeId,
     templateId,
     'Customer Artwork Title',
     artworkUrl,
     'artwork' // placeholder name
   )
   ```
4. **Gelato returns:**
   - Product ID
   - Mockup URLs for each variant
   - Preview URL
5. **Customer sees realistic mockup** showing their art on the product
6. **At checkout** → Order submitted to Gelato for printing

---

## Alternative: Static Mockups (Current)

If you prefer not to set up templates, the app currently uses:
- **Static lifestyle mockups** (images in `/public/images/mockups/`)
- **MockupGallery component** displays these pre-made images
- Orders still work with Gelato API for fulfillment

This approach is simpler and works immediately without template setup.

---

## API Functions Available

### Template-Based Product Creation
```typescript
import { createProductFromTemplate } from './services/gelatoService';

const result = await createProductFromTemplate(
  storeId,
  templateId,
  title,
  artworkUrl,
  placeholderName
);
// Returns: { id, title, status, previewUrl, variants: [{ mockupUrl }] }
```

### List Templates
```typescript
import { listGelatoTemplates } from './services/gelatoService';

const templates = await listGelatoTemplates();
```

### Get Template Details
```typescript
import { getGelatoTemplate } from './services/gelatoService';

const template = await getGelatoTemplate(templateId);
```

---

## Testing

### Test Order Submission (Already Working)
1. Create artwork in Studio
2. Add to cart from MockupGallery
3. Checkout with address
4. Check Gelato Dashboard → Orders (will be "draft" status)

### Test Mockup Generation (After Template Setup)
1. Ensure `VITE_GELATO_STORE_ID` is set
2. Add template IDs to products
3. Use `createProductFromTemplate()` function
4. Verify mockup URLs are returned

---

## Environment Variables Summary

```env
# Required for order fulfillment (✅ Already configured)
VITE_GELATO_API_KEY=your_api_key

# Required for mockup generation (⚙️ Needs setup)
VITE_GELATO_STORE_ID=your_store_id
```

---

## Resources

- [Gelato API Documentation](https://dashboard.gelato.com/docs/)
- [Create Products from Template Guide](https://support.gelato.com/en/articles/8996064-creating-products-via-api-from-template)
- [Gelato Dashboard](https://dashboard.gelato.com)
- [Template Management](https://dashboard.gelato.com/templates)

---

## Questions?

The current implementation provides:
- ✅ Full order fulfillment via Gelato API
- ✅ Static mockup images for product previews
- ⚙️ Template infrastructure ready for dynamic mockups (requires dashboard setup)

Choose the approach that fits your needs!
