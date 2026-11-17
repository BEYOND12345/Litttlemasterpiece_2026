# Payments and fulfilment

How a parent pays for a gift, how it reaches Gelato, how to deploy it, and how
to prove it works. Status on 2026-11-17: **built and unit-tested; never run
against live Stripe, Supabase or Gelato.** The four acceptance checks at the end
are the first time it will be.

## The sequence

```
browser                         Supabase Edge Functions                  outside
-------                         -----------------------                  -------
Order pressed
  -> create-order  ------------> pending gift_orders row
                   <------------ order id + one-time upload URL + print size
make print PNG (from the original photo, at print size)
  -> upload PNG ----------------> private bucket print-files/orders/<id>/print.png
  -> create-checkout -----------> price read from gift_products  ---------> Stripe: Checkout Session
                   <------------ Stripe Checkout URL
redirect to Stripe ---------------------------------------------------------> customer pays
                                stripe-webhook  <-------------------------- checkout.session.completed
                                  verify signature, re-read session
                                  pending -> paid -> submitting (claim)
                                  POST order ---------------------------------> Gelato (draft by default)
                                  -> in_production + gelato_order_id
back on ?session_id=cs_...
  -> order-status --------------> product, look, status (no personal data)
                                gelato-webhook  <-------------------------- order_status_updated
                                  in_production -> shipped -> delivered
```

Rules this enforces:

- **Gelato is called from one place:** `stripe-webhook`, after a verified
  signature, a re-read session with `payment_status = 'paid'`, and a won claim.
  There is no Gelato key or Gelato call anywhere in the browser.
- **The price is the database's.** `create-checkout` reads `gift_products.price_cents`
  and stores it on the order; the webhook holds any order where Stripe charged a
  different amount or currency. The browser never sends a price; one added to a
  request is ignored.
- **One print per payment.** `claim_gift_order` is a single
  `UPDATE ... WHERE status IN ('paid','fulfilment_failed') RETURNING`, so of two
  simultaneous deliveries exactly one gets the row. A crash after Gelato accepted
  the order leaves it `submitting`, which nothing ever resends.
- **A declined card creates no Gelato order:** Stripe never completes the
  session, so no event arrives.
- **Gelato orders are drafts** unless the secret `GELATO_ORDER_TYPE` is exactly `order`.

## Order status

| Status | Meaning | Set by |
|---|---|---|
| `pending` | Order row exists; not paid | create-order |
| `paid` | Stripe confirmed payment; not yet sent | stripe-webhook |
| `submitting` | One delivery has claimed it and is calling Gelato | claim_gift_order |
| `fulfilment_failed` | Gelato returned an error; nothing created; retried on the next Stripe retry | stripe-webhook |
| `in_production` | Gelato accepted it; `gelato_order_id` set | stripe-webhook |
| `shipped` / `delivered` | Reported by Gelato | gelato-webhook |
| `cancelled` | Cancelled at Gelato, or by hand | gelato-webhook / by hand |

The trigger `gift_orders_guard` refuses any other status change, and refuses
changing product, look or amount once an order is paid.

**Stuck in `submitting`** means the function could not tell whether Gelato got
the order (timeout, or Gelato accepted it and the database write failed).
`last_error` says which. Search Gelato for the order reference (= our order id),
then in the SQL editor either
`update gift_orders set status='in_production', gelato_order_id='<gelato id>' where id='<order id>';`
or `update gift_orders set status='fulfilment_failed' where id='<order id>';`
and press **Resend** on the event in Stripe to try again.

## Deploy

Needs the Supabase CLI (`npx supabase ...` downloads it) and the project ref
(Supabase dashboard, Project Settings, General).

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# 1. Database. CHECK FIRST: if the older migrations were applied by hand
#    (dashboard SQL editor, Bolt) they will show as not applied here, and
#    `db push` would try to run them again and fail on CREATE POLICY.
npx supabase migration list
#    For each OLD migration listed as local-only that the database already has:
#      npx supabase migration repair --status applied <version>
#    Then push; only 20261117000000_christmas_checkout should be pending:
npx supabase db push
#    (Alternative: paste supabase/migrations/20261117000000_christmas_checkout.sql
#     into the SQL editor and run it once.)

# 2. Secrets. Write them to a file OUTSIDE the repo (not in shell history),
#    one NAME=value per line:
#      STRIPE_SECRET_KEY=sk_test_...
#      STRIPE_WEBHOOK_SECRET=whsec_...        (from step 4; set it again then)
#      GELATO_API_KEY=...
#      GELATO_ORDER_TYPE=draft                (change to "order" only after the checks pass)
#      GELATO_WEBHOOK_SECRET=<output of: openssl rand -hex 32>
#      SITE_URL=https://your-site.example
#      ALLOWED_ORIGINS=http://localhost:5173  (optional, for local testing)
npx supabase secrets set --env-file ~/littlemasterpiece-secrets.env
npx supabase secrets list

# 3. Functions. The two webhooks are called by Stripe and Gelato, which send
#    no Supabase JWT: their signature / token is the authentication.
npx supabase functions deploy create-order
npx supabase functions deploy create-checkout
npx supabase functions deploy order-status
npx supabase functions deploy stripe-webhook --no-verify-jwt
npx supabase functions deploy gelato-webhook --no-verify-jwt
```

If the project uses the new publishable keys (`sb_publishable_...`) instead of
the legacy anon JWT, deploy the three browser functions with `--no-verify-jwt`
too; none of them relies on the caller's JWT.

### 4. Stripe webhook

Stripe Dashboard (test mode first), Developers, Webhooks, Add endpoint:

- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
- Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
  (the second covers payment methods that settle later). Nothing else is needed;
  any other event is acknowledged and ignored.
- Copy the endpoint's **Signing secret** (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`
  and run `npx supabase secrets set --env-file ...` again.

### 5. Gelato webhook

Gelato dashboard, Developer, Webhooks: add
`https://YOUR_PROJECT_REF.supabase.co/functions/v1/gelato-webhook?token=<GELATO_WEBHOOK_SECRET>`
for **order status updated**. Gelato does not sign webhooks; the token is the only
thing that lets a request in, and even then it can only move an order we sent
forward along the status table.

### 6. The site

The browser needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. No
`VITE_` variable may ever hold a secret (see `.env.example`).

## Owner to-do

**Stripe**
- [ ] Account activated, AUD payouts, test-mode keys for the checks below.
- [ ] Decide whether Stripe emails receipts (Settings, Customer emails). The site does not promise one.
- [ ] Marketing consent: Checkout asks for `consent_collection: { promotions: 'auto' }`. Stripe shows
      that checkbox **only in some countries** (by the customer's locale); everywhere else no box is
      shown and the order is stored with `marketing_opt_in = false`. Only an explicit tick is ever a yes.
      **Stripe's API reference also says this option is "only available to US merchants".** If the
      account is Australian, Stripe will likely refuse it; create-checkout then retries once without it
      (logged as a warning in the function logs) so checkout still works, and no consent is collected
      at all. Check the create-checkout logs after acceptance check 1. If marketing consent is wanted
      on a non-US account, it needs its own checkbox on our site, which is not built.

**Gelato**
- [ ] Choose the framed print and the 11oz mug; put their product UIDs in the database:
      `update gift_products set gelato_product_uid = '...' where slug = 'framed';` (and `'mug'`).
      Until both are set, checkout refuses that product with "isn't connected to our printer".
- [ ] Set each product's real print size in pixels (`print_width_px`, `print_height_px`). The seeded
      2896x4096 (framed) and 2475x1155 (mug) are stand-ins.
- [ ] Framed orientation: the print file follows the drawing (a landscape drawing gets a landscape
      sheet). Gelato framed-poster UIDs usually end in `_ver` or `_hor`; confirm with Gelato that a
      landscape file on the chosen UID prints correctly, or ask for a landscape UID column to be added.
- [ ] Mug placement: the art is centred on the print area. Check on a first draft where the centre
      lands relative to the handle.
- [ ] **Shipping countries:** `SHIP_TO_COUNTRIES` in `supabase/functions/_shared/address.ts` is a broad
      list of countries Gelato is believed to ship to, and it is the ONE list both Stripe and the webhook
      use. Compare it with Gelato's shipping list for the two chosen products and delete any it does not
      deliver to, then redeploy create-checkout and stripe-webhook.
- [ ] Billing on the Gelato account (confirming a draft charges it). Shipping method is Gelato's default.

**Prices**
- [ ] Final AUD prices, including whether they cover shipping (Checkout adds none) and GST.
      `update gift_products set price_cents = 8900 where slug = 'framed';`
- [ ] Then the same numbers in `src/flow/products.ts`: those are DISPLAY ONLY and are not read by
      checkout, so a mismatch shows one price on the button and charges another.

**Not built (decide if needed)**
- Clean-up of abandoned `pending` orders and their print files.
- Rate limiting: anyone with the public anon key can create pending orders and upload a print file.
- Emails to the customer from us (order confirmation, shipping).
- Refunds: by hand in Stripe; cancel the Gelato order by hand.

## Acceptance checks

Run in Stripe **test mode**, with `GELATO_ORDER_TYPE` unset or `draft`, on the
deployed site. Card details for every check: any future expiry, any CVC, any
name; a real-looking address in an allowed country.

Keep this SQL open in the Supabase SQL editor:

```sql
select id, status, amount_cents, currency, stripe_session_id, gelato_order_id,
       submit_attempts, marketing_opt_in, last_error, created_at
from gift_orders order by created_at desc limit 5;
```

### 1. Card 4242 4242 4242 4242 creates exactly one Gelato draft

1. On the site: photo, look, gift, Order. Watch the four progress steps; you land on Stripe.
2. Pay with `4242 4242 4242 4242`.
3. Expect: back on the site, "Paid, and with our printer" (it may show "Confirming" for a few seconds).
4. SQL: newest row `status = in_production`, `gelato_order_id` set, `submit_attempts = 1`,
   `amount_cents` equal to `gift_products.price_cents`.
5. Gelato dashboard, Orders: exactly **one draft** whose order reference is that row's `id`,
   with the print file attached and the address you typed.
6. Stripe, Developers, Webhooks, the endpoint: the delivery answered **200**.

### 2. Declined card 4000 0000 0000 0002 creates zero

1. Same flow, pay with `4000 0000 0000 0002`. Stripe shows "Your card was declined."
2. Leave via the back link on Stripe's page; the site says "Payment cancelled. Nothing was charged."
3. SQL: that row is still `pending`, `gelato_order_id` null.
4. Stripe: no `checkout.session.completed` event for that session. Gelato: no order with that reference.

### 3. Replaying the same webhook event twice creates one

1. Stripe, Developers, Events: open the `checkout.session.completed` event from check 1.
2. On the webhook endpoint's delivery list, press **Resend**. Then press it again straight away.
   (CLI alternative: `stripe events resend <evt_id> --webhook-endpoint <we_id>`; check
   `stripe events resend --help` for the exact flags of your CLI version.)
3. Expect each resend to answer 200 `{"done":"already with Gelato"}` (a resend that overlaps a
   delivery still in flight answers 503 and Stripe retries it later; that is correct).
4. SQL: same row, still `in_production`, `submit_attempts` still **1**.
5. Gelato: still exactly **one** draft with that reference.
6. Unsigned replay: send the event body without a valid signature:
   ```bash
   curl -s -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook" \
     -H "Content-Type: application/json" -H "Stripe-Signature: t=1,v1=00" \
     -d '{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_x"}}}'
   ```
   Expect `400` with "signature check failed". Nothing changes anywhere.

### 4. Tampering with the price client-side does not change the amount charged

The browser sends no price at all, so there are two things to try.

a. **The displayed price.** Edit the button's price in DevTools (or `priceCents` in
   `src/flow/products.ts` on a local build) to `$1` and order. The Stripe page shows the
   database price, and after paying with 4242 the SQL row's `amount_cents` and Stripe's
   payment amount both equal `gift_products.price_cents`.

b. **Prices injected into the requests.** With the deployed functions (needs `curl`, `jq`
   and any PNG at `./test.png`):

   ```bash
   set -euo pipefail
   SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"   # edit
   ANON_KEY="your anon key"                              # edit
   ORIGIN="https://your-site.example"                    # = SITE_URL
   call() { curl -sS -X POST "$SUPABASE_URL/functions/v1/$1" \
     -H "Authorization: Bearer $ANON_KEY" -H "apikey: $ANON_KEY" \
     -H "Origin: $ORIGIN" -H "Content-Type: application/json" -d "$2"; }

   ORDER=$(call create-order '{"product":"mug","look":"as_drawn","price_cents":1,"amount":1,"currency":"usd"}')
   echo "$ORDER"
   ORDER_ID=$(echo "$ORDER" | jq -r .orderId)
   FILE_PATH=$(echo "$ORDER" | jq -r .path)
   TOKEN=$(echo "$ORDER" | jq -r .token)
   curl -sS -X PUT "$SUPABASE_URL/storage/v1/object/upload/sign/print-files/$FILE_PATH?token=$TOKEN" \
     -H "Content-Type: image/png" --data-binary @test.png
   echo
   call create-checkout "{\"orderId\":\"$ORDER_ID\",\"price_cents\":1,\"unit_amount\":1,\"amount_total\":1}"
   echo
   ```

   Open the returned `url`: Stripe shows the database price for the mug. In SQL the order's
   `amount_cents` is the database price. Also confirm the tables refuse direct writes with the
   anon key (both must change nothing):

   ```bash
   curl -sS -X PATCH "$SUPABASE_URL/rest/v1/gift_products?slug=eq.mug" -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{"price_cents":1}'
   curl -sS "$SUPABASE_URL/rest/v1/gift_orders?select=*" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
   ```

   Expect a permission error (or an empty result) for both, and the price unchanged in SQL.

## What is tested, and what is not

Tested locally (`npm run test:unit`, `npm run typecheck:functions`):

- The status machine, and that the SQL trigger, status CHECK and claim function list the same
  statuses and transitions as `status.ts` (read from the migration file).
- Request parsing (prices in bodies ignored), CORS, address mapping (both Stripe API shapes,
  worldwide list, consent), Gelato payload and response reading, Checkout Session parameters.
- The whole webhook decision sequence against an **in-memory** store: one Gelato order per paid
  order on sequential and concurrent double delivery, zero for unpaid or held orders, retry after a
  Gelato error, no resend after an unknown outcome or a crash after success.
- Signature verification through the real `stripe@18.5.0` SDK with the SubtleCrypto provider,
  using locally signed payloads.
- The functions type-check against the real Stripe and supabase-js types (Deno's own checker has
  not run on them).

Not tested, needs the live services:

- The migration has never been applied to a Postgres database.
- No function has run in Deno or on Supabase; no request has reached Stripe, Supabase Storage or Gelato.
- The atomicity of `claim_gift_order` under real concurrent deliveries.
- Gelato's actual request/response format, its acceptance of the PNG and signed URL, and its webhook payload.
- The browser print file on a phone (memory, time), the signed upload, and the redirect to Stripe.
