/*
  Christmas checkout: what is sold, what was ordered, and where the print
  files live. docs/PAYMENTS.md is the runbook.

  NEW TABLES, NOT THE OLD ONES. `products` and `orders` already exist
  (20251128055713) with a different shape and with RLS that lets a signed-in
  user insert and update their OWN order rows, total and status included.
  Nothing in the paid path may read a price or a status a browser can write,
  so the paid path gets its own two tables, `gift_products` and `gift_orders`,
  which only the service role (the Edge Functions) can write.

  The sequence these tables serve, and the only place Gelato is ever called:

    browser -> create-order (pending row + signed upload URL)
            -> uploads the print PNG to the PRIVATE bucket
            -> create-checkout (price read HERE, Stripe Checkout Session)
            -> customer pays on Stripe
            -> stripe-webhook (signature verified) -> paid -> claim -> Gelato

  Status, and who moves it (gift_orders_guard below rejects anything else):

    pending            row exists; print file may still be uploading; not paid
    paid               Stripe says paid (verified webhook); not yet sent
    submitting         ONE webhook delivery has claimed it and is calling Gelato.
                       Never left automatically: if the function dies here we
                       cannot know whether Gelato got the order, so a person
                       checks Gelato for orderReferenceId = id and sets
                       in_production or fulfilment_failed by hand.
    fulfilment_failed  Gelato answered with an error; nothing was created. The
                       next Stripe retry (or a manual Resend) may claim it again.
    in_production      Gelato accepted it (draft or real); gelato_order_id set
    shipped            Gelato reported it shipped (gelato-webhook)
    delivered          Gelato reported it delivered (gelato-webhook)
    cancelled          cancelled at Gelato, or by hand before sending
*/

-- ---------------------------------------------------------------------------
-- What can be bought. Prices live HERE and nowhere else that is trusted.
-- ---------------------------------------------------------------------------
CREATE TABLE public.gift_products (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z][a-z0-9_]{0,31}$'),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  currency text NOT NULL DEFAULT 'aud' CHECK (currency = 'aud'),
  -- NULL until the owner picks the Gelato product. While NULL, create-order
  -- and create-checkout refuse with a clear error rather than take money for
  -- something that cannot be printed.
  gelato_product_uid text CHECK (gelato_product_uid IS NULL OR length(trim(gelato_product_uid)) > 0),
  -- The print file's pixel size, portrait-or-landscape as Gelato lists it.
  -- The framed print is rotated to the drawing's orientation in the browser.
  print_width_px integer NOT NULL CHECK (print_width_px BETWEEN 100 AND 10000),
  print_height_px integer NOT NULL CHECK (print_height_px BETWEEN 100 AND 10000),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_products ENABLE ROW LEVEL SECURITY;

-- Anyone may read the catalogue. Nobody but the service role may change it:
-- there is deliberately no INSERT/UPDATE/DELETE policy, and the grants are
-- taken away as well so a missing policy is not the only wall.
CREATE POLICY "Gift products are publicly readable"
  ON public.gift_products FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.gift_products FROM anon, authenticated;
GRANT SELECT ON public.gift_products TO anon, authenticated;

-- PLACEHOLDERS. 8900 and 2400 are the old seed prices
-- (20251128055713: "The Gallery Frame (Oak)", "Ceramic Artist Mug"). The
-- product UIDs are NULL on purpose and the pixel sizes are stand-ins:
-- 2896x4096 is an A-series sheet at the browser's 4096px print cap, and
-- 2475x1155 is a common 11oz mug wrap. Replace all of them with Gelato's
-- figures for the products actually chosen (docs/PAYMENTS.md, owner to-do).
INSERT INTO public.gift_products (slug, name, price_cents, currency, gelato_product_uid, print_width_px, print_height_px)
VALUES
  ('framed', 'Framed print', 8900, 'aud', NULL, 2896, 4096),
  ('mug', 'Mug', 2400, 'aud', NULL, 2475, 1155)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- What was ordered. Service role only: RLS on, no policies, no grants.
-- ---------------------------------------------------------------------------
CREATE TABLE public.gift_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL REFERENCES public.gift_products(slug),
  look text NOT NULL CHECK (look IN ('as_drawn', 'screen_print')),
  -- Derived from the id, so a browser can never choose where its file lands
  -- or point an order at someone else's file.
  print_file_path text GENERATED ALWAYS AS ('orders/' || id::text || '/print.png') STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'submitting', 'fulfilment_failed',
    'in_production', 'shipped', 'delivered', 'cancelled'
  )),
  stripe_session_id text UNIQUE,
  -- Set by create-checkout from gift_products at the moment the Stripe
  -- session is made, and checked against what Stripe actually charged.
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents > 0),
  currency text NOT NULL DEFAULT 'aud' CHECK (currency = 'aud'),
  -- From Stripe Checkout, which always collects an email.
  customer_email text,
  -- true ONLY when Stripe reported consent.promotions = 'opt_in'. Stripe
  -- shows that checkbox in some countries only; no answer is a no.
  marketing_opt_in boolean NOT NULL DEFAULT false,
  -- { name, phone, email, address: { line1, line2, city, state, postal_code, country } }
  shipping jsonb,
  gelato_order_id text UNIQUE,
  -- Gelato's own fulfillmentStatus text, verbatim, from its webhook.
  gelato_status text,
  last_error text,
  submit_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  submitted_at timestamptz
);

CREATE INDEX gift_orders_status_idx ON public.gift_orders (status);
CREATE INDEX gift_orders_created_at_idx ON public.gift_orders (created_at DESC);

ALTER TABLE public.gift_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gift_orders FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- The status machine, enforced by the database as well as by the functions.
-- supabase/functions/_shared/status.ts holds the same list, and
-- status.test.ts fails if the two ever disagree.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gift_orders_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'gift_orders: a new order must start as pending, not %', NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND (OLD.status, NEW.status) NOT IN (
    -- transitions:begin
    ('pending', 'paid'),
    ('paid', 'submitting'),
    ('fulfilment_failed', 'submitting'),
    ('submitting', 'in_production'),
    ('submitting', 'fulfilment_failed'),
    ('in_production', 'shipped'),
    ('in_production', 'delivered'),
    ('shipped', 'delivered'),
    ('paid', 'cancelled'),
    ('fulfilment_failed', 'cancelled'),
    ('in_production', 'cancelled')
    -- transitions:end
  ) THEN
    RAISE EXCEPTION 'gift_orders: % -> % is not an allowed status change', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- What was sold, and for how much, is fixed once money can have moved.
  IF OLD.status <> 'pending' AND (
       NEW.product IS DISTINCT FROM OLD.product
    OR NEW.look IS DISTINCT FROM OLD.look
    OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
  ) THEN
    RAISE EXCEPTION 'gift_orders: product, look and amount are fixed once an order is paid'
      USING ERRCODE = 'check_violation';
  END IF;

  -- A Gelato order id, once recorded, is never replaced or cleared.
  IF OLD.gelato_order_id IS NOT NULL AND NEW.gelato_order_id IS DISTINCT FROM OLD.gelato_order_id THEN
    RAISE EXCEPTION 'gift_orders: gelato_order_id is already set'
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER gift_orders_guard
  BEFORE INSERT OR UPDATE ON public.gift_orders
  FOR EACH ROW EXECUTE FUNCTION public.gift_orders_guard();

CREATE OR REPLACE FUNCTION public.gift_products_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER gift_products_touch
  BEFORE UPDATE ON public.gift_products
  FOR EACH ROW EXECUTE FUNCTION public.gift_products_touch();

-- ---------------------------------------------------------------------------
-- The fulfilment claim. ONE statement, so when Stripe delivers the same
-- event twice at once, Postgres lets exactly one of them through: the loser
-- re-checks the WHERE after the winner commits, finds 'submitting', and gets
-- no row back. Only the caller that gets a row may call Gelato.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_gift_order(p_order_id uuid)
RETURNS SETOF public.gift_orders
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.gift_orders
     SET status = 'submitting',
         submit_attempts = submit_attempts + 1,
         last_error = NULL
   WHERE id = p_order_id
     AND status IN ('paid', 'fulfilment_failed') -- claimable:from
  RETURNING *;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_gift_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_gift_order(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Print files. PRIVATE: no storage.objects policy names this bucket, so
-- anon and signed-in users can neither list, read nor write it. The browser
-- uploads through a one-time signed upload URL made by create-order; Gelato
-- reads through a signed download URL made by stripe-webhook. Only the
-- canvas-made PNG goes here, never the parent's original photo (which can
-- carry EXIF, GPS included).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('print-files', 'print-files', false, 52428800, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
