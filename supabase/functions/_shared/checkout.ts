/**
 * The Stripe side of checkout: rows, the sellable check, and the exact
 * Checkout Session request. The price in that request comes from a
 * gift_products row and from nowhere else.
 *
 * Pure: no Deno, no network, no Stripe import. The object built here is
 * handed to stripe.checkout.sessions.create in create-checkout/index.ts,
 * where the real SDK types check it.
 */
import { BadRequest, type Look } from './validate.ts';
import type { OrderStatus } from './status.ts';
import { SHIP_TO_COUNTRIES } from './address.ts';

export const PRINT_BUCKET = 'print-files';

export interface ProductRow {
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  gelato_product_uid: string | null;
  print_width_px: number;
  print_height_px: number;
  active: boolean;
}

export interface OrderRow {
  id: string;
  product: string;
  look: Look;
  print_file_path: string;
  status: OrderStatus;
  stripe_session_id: string | null;
  amount_cents: number | null;
  currency: string;
  gelato_order_id: string | null;
}

export const LOOK_LABELS: Record<Look, string> = {
  as_drawn: 'As drawn',
  screen_print: 'Screen print',
};

/**
 * Refuses, with a sentence a parent can read, anything that cannot be both
 * charged for and printed. 409 rather than 400: the request is fine, the
 * shop is not ready.
 */
export function assertSellable(product: ProductRow | null): asserts product is ProductRow & { gelato_product_uid: string } {
  if (!product || !product.active) throw new BadRequest('That gift is not available right now.', 409);
  if (!product.gelato_product_uid || !product.gelato_product_uid.trim()) {
    throw new BadRequest(
      `${product.name} can't be ordered yet: it isn't connected to our printer. Nothing has been charged.`,
      409,
    );
  }
  if (product.currency !== 'aud') throw new BadRequest('That gift is not priced in Australian dollars.', 409);
  if (!Number.isInteger(product.price_cents) || product.price_cents <= 0) {
    throw new BadRequest('That gift has no price yet.', 409);
  }
}

/**
 * success_url and cancel_url. `{CHECKOUT_SESSION_ID}` must reach Stripe with
 * its braces intact (Stripe fills it in), so this is built as a string, not
 * through URLSearchParams, which would encode them.
 */
export function returnUrls(siteUrl: string): { success: string; cancel: string } {
  const u = new URL(siteUrl);
  if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
    throw new Error('SITE_URL must be https');
  }
  const base = `${u.origin}${u.pathname.replace(/\/+$/, '')}/`;
  return {
    success: `${base}?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}?checkout=cancelled`,
  };
}

/** The Checkout Session request, as plain data. */
export function checkoutSessionParams(order: Pick<OrderRow, 'id' | 'look'>, product: ProductRow, siteUrl: string) {
  const urls = returnUrls(siteUrl);
  return {
    mode: 'payment' as const,
    currency: 'aud',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'aud',
          unit_amount: product.price_cents,
          product_data: {
            name: product.name,
            description: `${LOOK_LABELS[order.look]}, made from your child's drawing`,
          },
        },
      },
    ],
    shipping_address_collection: { allowed_countries: [...SHIP_TO_COUNTRIES] },
    phone_number_collection: { enabled: true },
    // Stripe shows the marketing box only where the law asks for one; the
    // webhook stores true only for an explicit opt_in.
    consent_collection: { promotions: 'auto' as const },
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    payment_intent_data: { metadata: { order_id: order.id } },
    success_url: urls.success,
    cancel_url: urls.cancel,
  };
}

/**
 * Stripe's API reference says consent_collection.promotions is "only
 * available to US merchants". If Stripe refuses that one parameter for this
 * account, checkout must still work: create-checkout retries once without
 * it, and the order's marketing_opt_in stays false (no answer is a no).
 */
export function isPromotionsConsentRefusal(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { type?: unknown; param?: unknown; message?: unknown };
  const invalid = e.type === 'StripeInvalidRequestError' || e.type === 'invalid_request_error';
  const param = typeof e.param === 'string' ? e.param : '';
  const message = typeof e.message === 'string' ? e.message : '';
  return invalid && (param.startsWith('consent_collection') || /consent_collection/.test(message));
}

export function withoutPromotionsConsent<T extends { consent_collection?: unknown }>(params: T): Omit<T, 'consent_collection'> {
  const { consent_collection: _dropped, ...rest } = params;
  void _dropped;
  return rest;
}

/**
 * Stripe idempotency key for creating the session. Two create-checkout calls
 * racing for the same order (a double tap) send the same key and get the
 * SAME session back, so one order cannot end up with two payable sessions.
 * The previous session and the price are in the key because Stripe refuses a
 * reused key with different parameters.
 */
export function checkoutIdempotencyKey(orderId: string, previousSessionId: string | null, priceCents: number): string {
  return `gift-checkout:${orderId}:${previousSessionId ?? 'first'}:${priceCents}`;
}

/**
 * What to do with a session this order already has.
 *  - reuse:  still open at today's price; send the parent back to it.
 *  - paid:   already complete; the webhook will (or did) move the order on.
 *  - replace_expire: open but at an old price; expire it, then make a new one.
 *  - replace: expired; make a new one.
 */
export function existingSessionDecision(
  existing: { status?: string | null; amount_total?: number | null; currency?: string | null },
  priceCents: number,
): 'reuse' | 'paid' | 'replace_expire' | 'replace' {
  if (existing.status === 'complete') return 'paid';
  if (existing.status === 'open') {
    return existing.amount_total === priceCents && existing.currency === 'aud' ? 'reuse' : 'replace_expire';
  }
  return 'replace';
}

/** True when a storage listing of the order's folder holds a non-empty print.png. */
export function printFileReady(
  listing: Array<{ name: string; metadata?: Record<string, unknown> | null }> | null,
  path: string,
): boolean {
  const name = path.split('/').pop();
  const hit = (listing ?? []).find((o) => o.name === name);
  const size = hit?.metadata?.size;
  return typeof size === 'number' && size > 0;
}

/** Who this paid session is for. Both references are ours and must agree. */
export function orderIdFromSession(session: {
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}): { ok: true; orderId: string } | { ok: false; reason: string; conflict: boolean } {
  const a = session.client_reference_id ?? null;
  const b = session.metadata?.order_id ?? null;
  if (!a && !b) return { ok: false, reason: 'session carries no order reference', conflict: false };
  if (a && b && a.toLowerCase() !== b.toLowerCase()) {
    return { ok: false, reason: `client_reference_id ${a} and metadata.order_id ${b} disagree`, conflict: true };
  }
  const id = (a ?? b) as string;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, reason: `order reference ${id} is not an order id`, conflict: false };
  }
  return { ok: true, orderId: id.toLowerCase() };
}
