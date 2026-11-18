# Launch checklist

Nothing on this list is done until it is ticked here. Ordering stays OFF
(`VITE_CHECKOUT_LIVE` unset) until every item in sections 1 to 4 is ticked.

## 1. Placeholder facts on the site (owner to confirm or replace)

Placeholders are in on the owner's instruction (2026-11-18) so the preview
reads cleanly. Each is wrapped in `<Placeholder confirm="...">` and
`grep -rn "<Placeholder" src` must find none at launch.

| Fact | Placeholder now | Where |
|---|---|---|
| Contact email | hello@littlemasterpiece.com.au (does not exist yet) | `src/components/legal/business.ts` |
| ABN | 58 600 491 085, taken from the SMASH site footer; check on ABN Lookup it is MotionStory Pty Ltd's | `business.ts`, footer |
| Legal pages' effective date | 18 November 2026 | `business.ts` |
| Shipping cost | "included in the price" | Terms, Shipping & Returns |
| Delivery times | "printed within a few business days, about 1 to 2 weeks" | Shipping & Returns |
| Christmas last order dates | "we'll post them here" | Shipping & Returns |
| Import duties outside Australia | "paid on delivery if they apply" | Shipping & Returns |
| Hosting and storage providers | "Supabase and our website host" | Privacy |
| Where data is stored | "Australia, the United States and the European Union" | Privacy |
| Print file retention | 90 days after delivery (**the deletion job does not exist yet**, see 4) | Privacy |
| Order record retention | 5 years | Privacy |
| Governing law | New South Wales | Terms |
| Prices | Framed $89, mug $24 (old seed data) | `src/flow/products.ts` and the `gift_products` table |
| Framed print size | not stated ("Oak frame, ready to hang") | `products.ts` |

The legal pages are drafts written for this product, not legal advice. Have
them read before launch.

## 2. Accounts and keys (owner)

- [ ] Stripe: a Sandbox for testing; later the live account. The Claude Stripe
      connector currently sees only a live account called "One".
- [ ] Supabase: find the project the site points at (`bhltnhutjgyzvbcsjitp`,
      probably created by Bolt in another account) or create a fresh
      `little-masterpiece` project.
- [ ] Gelato: API key; product UIDs and print pixel sizes for the framed print
      and the 11oz mug (the seeded ones are stand-ins); whether wrapping paper
      exists; Australian Christmas cutoffs.
- [ ] Rotate every key that was ever set as a `VITE_` variable on the live
      host (Gelato, Cloudinary secret, Gemini, remove.bg). They shipped in the
      public bundle and must be treated as public.
- [ ] Delete artwork the old studio uploaded to Cloudinary (public CDN).

## 3. Deploy (docs/PAYMENTS.md has the commands)

- [ ] Apply migrations, including `20261117000000_christmas_checkout.sql` and
      `20261117000100_private_artworks_bucket.sql`.
- [ ] Deploy the five Edge Functions; set their secrets in Supabase.
- [ ] Stripe webhook endpoint pointing at `stripe-webhook`.
- [ ] Gelato webhook pointing at `gelato-webhook` (for "shipped").
- [ ] Site host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. No other
      `VITE_` secret, ever.
- [ ] Turn on Stripe's email receipts (the order confirmation email).

## 4. Prove it

- [ ] The four acceptance checks in docs/PAYMENTS.md, in test mode: card 4242
      makes exactly one Gelato draft; declined card 0002 makes none; the same
      webhook twice makes one; a tampered price changes nothing.
- [ ] Real photos of real drawings through `/batch-test` (dev) on a laptop,
      and the flow on a real iPhone and a real Android phone.
- [ ] Print-file deletion 90 days after delivery: build it (a scheduled
      Edge Function) or change the Privacy wording.
- [ ] One real order of each product, paid with a real card, posted to the
      owner. Judge the physical print: sharpness, colour, crop, paper white.
- [ ] Then set `VITE_CHECKOUT_LIVE=true` and rebuild.

## 5. Known, accepted for launch

- No automatic crop: a photo with table round the paper keeps the table, and
  the flow asks for a closer photo. Screen print is offered only when white
  paper fills the photo.
- The landing page's product photos are generated illustrations, captioned
  as examples.
- Old features (accounts, cart, credits, old studio, blog) are unlinked but
  still in the code and the bundle.
