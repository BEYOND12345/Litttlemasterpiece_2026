/**
 * create-checkout: turns a pending order whose print file has arrived into a
 * Stripe Checkout Session, priced from gift_products. The body names an
 * order and nothing else; any price in it is ignored.
 *
 * POST { orderId } -> 200 { url }   (the browser redirects to it)
 *                  -> 409 not sellable / already paid / print file missing
 *                  -> 404 no such order
 */
import { admin, corsFor, requireEnv, stripeClient } from '../_runtime/clients.ts';
import {
  PRINT_BUCKET,
  assertSellable,
  checkoutIdempotencyKey,
  checkoutSessionParams,
  existingSessionDecision,
  isPromotionsConsentRefusal,
  printFileReady,
  withoutPromotionsConsent,
  type OrderRow,
  type ProductRow,
} from '../_shared/checkout.ts';
import { NOTHING_CHARGED, errorResponse, json } from '../_shared/http.ts';
import { BadRequest, parseCreateCheckout } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  let cors: Record<string, string> = {};
  try {
    cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' }, cors);

    const { orderId } = parseCreateCheckout(await req.json().catch(() => null));
    const siteUrl = requireEnv('SITE_URL');
    const db = admin();

    const { data: orderData, error: orderError } = await db
      .from('gift_orders')
      .select('id, product, look, print_file_path, status, stripe_session_id, amount_cents, currency, gelato_order_id')
      .eq('id', orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    const order = orderData as OrderRow | null;
    if (!order) throw new BadRequest('We could not find that order. Please start again.', 404);
    if (order.status !== 'pending') throw new BadRequest('This order has already been paid for.', 409);

    // The price. From the database, now, and from nowhere else.
    const { data: productData, error: productError } = await db
      .from('gift_products')
      .select('*')
      .eq('slug', order.product)
      .maybeSingle();
    if (productError) throw productError;
    assertSellable(productData as ProductRow | null);
    const product = productData as ProductRow;

    // No file, no checkout: never take money for an order Gelato cannot print.
    const folder = order.print_file_path.split('/').slice(0, -1).join('/');
    const { data: listing, error: listError } = await db.storage.from(PRINT_BUCKET).list(folder, { limit: 10 });
    if (listError) throw listError;
    if (!printFileReady(listing, order.print_file_path)) {
      throw new BadRequest('Your print file did not finish uploading. Please try again.', 409);
    }

    const stripe = stripeClient();

    if (order.stripe_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      const decision = existingSessionDecision(existing, product.price_cents);
      if (decision === 'reuse' && existing.url) return json(200, { url: existing.url }, cors);
      if (decision === 'paid') throw new BadRequest('This order has already been paid for.', 409);
      if (decision === 'replace_expire') await stripe.checkout.sessions.expire(existing.id);
    }

    const params = checkoutSessionParams(order, product, siteUrl);
    const key = checkoutIdempotencyKey(order.id, order.stripe_session_id, product.price_cents);
    let session;
    try {
      session = await stripe.checkout.sessions.create(params, { idempotencyKey: key });
    } catch (e) {
      if (!isPromotionsConsentRefusal(e)) throw e;
      // Not available for this Stripe account (US merchants only, per Stripe).
      // Checkout without the box; marketing_opt_in stays false.
      console.warn('[create-checkout] Stripe refused consent_collection.promotions; continuing without it:', e);
      session = await stripe.checkout.sessions.create(withoutPromotionsConsent(params), {
        idempotencyKey: `${key}:no-promotions-consent`,
      });
    }
    if (!session.url) throw new Error(`Stripe returned session ${session.id} without a url`);

    // Stored with the session so the webhook can check Stripe charged exactly this.
    const { data: stored, error: storeError } = await db
      .from('gift_orders')
      .update({ stripe_session_id: session.id, amount_cents: product.price_cents, currency: product.currency })
      .eq('id', order.id)
      .eq('status', 'pending')
      .select('id');
    if (storeError) throw storeError;
    if ((stored ?? []).length === 0) throw new BadRequest('This order has already been paid for.', 409);

    return json(200, { url: session.url }, cors);
  } catch (e) {
    return errorResponse(e, cors, 'create-checkout', NOTHING_CHARGED);
  }
});
