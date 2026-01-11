# Database Architecture

## Overview

This database is designed for a **private artwork-to-product creator** with full dashboard experience. Users upload artwork, enhance it for print, preview on curated products, and order via Gelato.

## Core Principles

1. **User Privacy**: All user data (artworks, orders) is private with strict RLS
2. **Versioning**: One artwork can have multiple processed versions
3. **Audit Trail**: Order items reference specific artwork versions
4. **Extensibility**: Schema supports future features without breaking changes
5. **Edge Function Ready**: Designed for serverless processing workflows

---

## Entity Relationship Diagram

```
auth.users (Supabase Auth)
  ↓
profiles (1:1)
credits (1:1)
  ↓
artworks (1:many)
  ↓
artwork_versions (1:many)
  ↓
order_items (references artwork_version + product_variant)
  ↓
orders (contains order_items)

products (curated, admin-managed)
  ↓
product_variants (sizes/colors)
mockup_templates (Cloudinary configs)
```

---

## Table Descriptions

### 1. **profiles**
Extends `auth.users` with application-specific data.

**Key Fields:**
- `full_name`, `avatar_url`: User display info
- `notification_preferences`: JSONB for flexible settings

**Why separate from auth.users?**
- Auth table is managed by Supabase
- Keeps app data isolated and extensible
- Easier to add custom fields without auth conflicts

---

### 2. **artworks**
Parent record for user uploads.

**Key Fields:**
- `original_file_url`: Link to uploaded file in storage
- `width_px`, `height_px`: Original dimensions
- `metadata`: JSONB for flexible extension (EXIF, tags, etc.)

**Design Decision:**
- One artwork can have many versions (enhanced, style variants)
- Parent record never changes, preserving upload history

---

### 3. **artwork_versions**
Enhanced/processed variants of artworks.

**Key Fields:**
- `version_type`: `original`, `enhanced`, `style_variant`
- `status`: `pending`, `processing`, `completed`, `failed`
- `is_print_ready`: Boolean flag for printability
- `processing_details`: JSONB for enhancement logs
- `dpi`: Print resolution tracking

**Design Decision:**
- Separates processing state from parent artwork
- Supports multiple enhancement attempts
- Edge Functions update status as processing progresses
- Order items reference specific versions (audit trail)

**Flow Example:**
1. User uploads → Create `artwork` + `artwork_version` (type: `original`, status: `pending`)
2. Edge Function processes → Update status to `processing`
3. Enhancement completes → Create new `artwork_version` (type: `enhanced`, status: `completed`)
4. User requests style variant → Create new `artwork_version` (type: `style_variant`)

---

### 4. **products**
Curated print products (admin-managed, not user-created).

**Key Fields:**
- `gelato_product_id`: Maps to Gelato API product
- `category`: `apparel`, `home`, `accessories`, etc.
- `is_active`: Easy enable/disable without deletion
- `display_order`: Control UI presentation order

**Design Decision:**
- Products are curated, not marketplace-style
- Separate from variants for flexible option management
- Extensible via `metadata` JSONB

---

### 5. **product_variants**
Size, color, material options for products.

**Key Fields:**
- `gelato_variant_id`: Maps to Gelato API variant
- `size`, `color`, `material`: Human-readable attributes
- `price_cents`: Variant-specific pricing

**Design Decision:**
- One product → many variants (e.g., T-shirt: S/M/L, Red/Blue)
- Separate pricing per variant
- Order items reference variants, not products

**Example:**
```
Product: "Classic T-Shirt"
  Variant: "Small, Black" → gelato_variant_id: "abc123"
  Variant: "Large, White" → gelato_variant_id: "def456"
```

---

### 6. **mockup_templates**
Cloudinary mockup generation configs.

**Key Fields:**
- `cloudinary_template_id`: Cloudinary named transformation
- `cloudinary_public_id`: Base mockup image
- `transformation_params`: JSONB with overlay settings (x, y, width, height)

**Design Decision:**
- Decouples mockup logic from products
- One product can have multiple mockup templates (different angles)
- Edge Functions use these to generate mockup URLs

**Example Flow:**
1. User selects product + artwork
2. Frontend fetches mockup templates for product
3. Edge Function generates Cloudinary URL with artwork overlay
4. Returns mockup preview URL to frontend

---

### 7. **orders**
User purchase records.

**Key Fields:**
- `order_number`: Human-readable ID (e.g., `ORD-20231215-12345`)
- `gelato_order_id`: Gelato API order reference
- `status`: Tracks lifecycle (`pending` → `submitted_to_gelato` → `shipped`)
- `shipping_address`: JSONB with full address
- `gelato_response`: JSONB storing API responses for debugging

**Design Decision:**
- Status enum covers full lifecycle
- Stores Gelato responses for audit/debugging
- Timestamps for each stage (`submitted_at`, `shipped_at`, etc.)

---

### 8. **order_items**
Individual products in an order.

**Key Fields:**
- `product_variant_id`: Which variant was ordered
- `artwork_version_id`: **Exactly which version** was printed
- `print_file_url`: Final print-ready file sent to Gelato
- `mockup_url`: Preview user saw when ordering

**Design Decision:**
- **Critical**: References `artwork_version_id`, not `artwork_id`
- Ensures exact version printed is recorded (audit trail)
- Captures pricing at time of order (snapshot)
- Stores mockup/print URLs for re-download/support

**Why version_id matters:**
```
Scenario: User orders print, then enhances artwork again.
Without version_id: Can't tell which version was printed.
With version_id: Exact version preserved forever.
```

---

### 9. **credits** (Optional Monetization)
User credit balance.

**Key Fields:**
- `balance`: Current available credits
- `total_earned`, `total_spent`: Running totals

**Design Decision:**
- One-to-one with users
- Auto-created on signup (trigger)
- Updated by Edge Functions during transactions

---

### 10. **credit_transactions** (Optional Monetization)
Audit log of credit usage.

**Key Fields:**
- `transaction_type`: `purchase`, `usage`, `refund`, `bonus`
- `amount`: Can be negative (usage) or positive (purchase)
- `balance_after`: Snapshot for reconciliation
- `related_order_id`, `related_artwork_id`: Context links

**Design Decision:**
- Immutable log (never update/delete)
- Links to orders/artworks for traceability
- Enables credit usage reports

---

## Security (RLS Policies)

### Private Data (User-scoped):
- `artworks`, `artwork_versions`, `orders`, `order_items`
- Policy: `auth.uid() = user_id`
- Users can ONLY see their own data

### Public Data (Authenticated read):
- `products`, `product_variants`, `mockup_templates`
- Policy: `is_active = true`
- Any authenticated user can browse catalog

### Admin Actions:
- Products/variants/templates managed via direct SQL or admin tool
- No policies for INSERT/UPDATE (admin only via service role)

---

## Processing Workflows

### Artwork Enhancement
1. User uploads → Insert `artwork` + `artwork_version` (status: `pending`)
2. Frontend calls Edge Function `/enhance-artwork`
3. Edge Function:
   - Updates status to `processing`
   - Calls Gemini/RemoveBG APIs
   - Uploads enhanced file to storage
   - Inserts new `artwork_version` (type: `enhanced`, status: `completed`)
4. Frontend polls or listens for completion

### Mockup Generation
1. User selects product + artwork version
2. Frontend fetches `mockup_templates` for product
3. Frontend calls Edge Function `/generate-mockup`
4. Edge Function:
   - Reads template `transformation_params`
   - Builds Cloudinary URL with artwork overlay
   - Returns signed URL
5. Frontend displays mockup

### Order Placement
1. User adds items to cart (frontend state)
2. User clicks checkout
3. Frontend calls Edge Function `/create-order`
4. Edge Function:
   - Validates artwork versions exist
   - Creates `order` + `order_items`
   - Calls Gelato API to submit order
   - Updates order with `gelato_order_id`
   - Returns order confirmation
5. Webhook from Gelato updates order status

---

## Extensibility

### Easy to Add:
- **New product types**: Insert into `products` + `product_variants`
- **New mockup angles**: Insert into `mockup_templates`
- **New enhancement types**: Add to `version_type` enum
- **User favorites**: New table `favorites` → `artwork_id`
- **Sharing**: Add `is_public` flag to artworks + public policies

### JSONB Fields for Flexibility:
- `artworks.metadata`: Tags, EXIF, color palette
- `artwork_versions.processing_details`: AI params, logs
- `products.metadata`: Print specs, care instructions
- `orders.shipping_address`: Future: add gift message, notes

---

## Performance Indexes

```sql
-- Artwork versions by artwork
idx_artwork_versions_artwork_id

-- Artwork versions by status (for polling)
idx_artwork_versions_status

-- Product variants by product
idx_product_variants_product_id

-- Mockup templates by product
idx_mockup_templates_product_id

-- Orders by user
idx_orders_user_id

-- Orders by status (for admin dashboard)
idx_orders_status

-- Order items by order
idx_order_items_order_id

-- Order items by artwork version (for "where was this printed?")
idx_order_items_artwork_version_id

-- Credit transactions by user
idx_credit_transactions_user_id
```

---

## Database Setup Instructions

1. Go to your Supabase project: https://bhltnhutjgyzvbcsjitp.supabase.co
2. Navigate to **SQL Editor**
3. Copy the contents of `database-schema-complete.sql`
4. Paste and run
5. Verify tables created successfully

**Clean Start (Optional):**
Uncomment the `DROP TABLE` statements at the top of the SQL file to start completely fresh.

---

## Next Steps

After running the migration:

1. **Seed Products**: Insert your curated products + variants
2. **Seed Mockup Templates**: Configure Cloudinary templates
3. **Build Edge Functions**:
   - `enhance-artwork`: Gemini + RemoveBG integration
   - `generate-mockup`: Cloudinary URL builder
   - `create-order`: Gelato API submission
   - `gelato-webhook`: Handle order status updates
4. **Update Frontend Services**: Connect to new schema
5. **Test Full Flow**: Upload → Enhance → Preview → Order

---

## Questions?

This architecture is designed to be:
- **Lean**: No unnecessary tables
- **Extensible**: Easy to add features
- **Secure**: Strict RLS on all user data
- **Audit-ready**: Version tracking and order history
- **Edge-first**: Optimized for serverless workflows

Ready to build!
