/**
 * What stripe-webhook does with a VERIFIED, re-read Checkout Session. This is
 * the only code that sends anything to Gelato.
 *
 *   1. Find our order from the session's own references.
 *   2. Not paid (async methods, still processing): change nothing.
 *   3. Record the payment: pending -> paid, with the address Stripe collected.
 *   4. Charged amount must equal the amount create-checkout stored from
 *      gift_products. If not, hold: nothing is sent.
 *   5. Claim: paid|fulfilment_failed -> submitting in ONE statement. Only the
 *      delivery that gets the row back continues. Others answer:
 *        submitting       503, so Stripe tries again later
 *        with Gelato      200, done
 *   6. Send to Gelato and record what happened:
 *        created  -> in_production + gelato_order_id           200
 *        rejected -> fulfilment_failed (retryable)              500
 *        unknown  -> stays submitting, never resent by code     500
 *
 * Every dependency is passed in, so the control flow above is tested in Node
 * against an in-memory store (fulfil.test.ts). That proves the ORDER of
 * operations and the retry rules; it does not prove Postgres, Stripe or
 * Gelato behave as assumed. Pure: no Deno, no network.
 */
import { marketingOptIn, shippingFromSession, toGelatoAddress, type ShippingRecord, type StripeSessionLike } from './address.ts';
import { orderIdFromSession, type OrderRow, type ProductRow } from './checkout.ts';
import { buildGelatoOrder, gelatoNetworkFailure, type GelatoOrderRequest, type GelatoOrderType, type GelatoOutcome } from './gelato.ts';
import { WITH_GELATO } from './status.ts';

export interface PaidDetails {
  stripeSessionId: string;
  email: string | null;
  marketingOptIn: boolean;
  shipping: ShippingRecord | null;
}

export interface FulfilDeps {
  orderType: GelatoOrderType;
  getOrder(id: string): Promise<OrderRow | null>;
  getProduct(slug: string): Promise<ProductRow | null>;
  /** pending -> paid. Resolves true when this call made the change. */
  markPaid(id: string, paid: PaidDetails): Promise<boolean>;
  /** claim_gift_order: the row when THIS call won the claim, else null. */
  claim(id: string): Promise<OrderRow | null>;
  /** submitting -> in_production. */
  markSubmitted(id: string, gelatoOrderId: string): Promise<void>;
  /** submitting -> fulfilment_failed. */
  markFailed(id: string, message: string): Promise<void>;
  /** Writes last_error only; status stays as it is. */
  noteError(id: string, message: string): Promise<void>;
  signedFileUrl(path: string): Promise<string>;
  /** Must resolve, never reject: a thrown error is read as 'unknown'. */
  createGelatoOrder(payload: GelatoOrderRequest): Promise<GelatoOutcome>;
}

export interface FulfilResult {
  status: number;
  body: Record<string, unknown>;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function amountProblem(order: Pick<OrderRow, 'amount_cents' | 'currency'>, session: StripeSessionLike): string | null {
  const charged = session.amount_total ?? null;
  const currency = (session.currency ?? '').toLowerCase();
  if (order.amount_cents === null) return `order has no stored amount; Stripe charged ${charged} ${currency}`;
  if (charged !== order.amount_cents || currency !== order.currency) {
    return `Stripe charged ${charged} ${currency}, order expects ${order.amount_cents} ${order.currency}`;
  }
  return null;
}

export async function fulfilCheckoutSession(deps: FulfilDeps, session: StripeSessionLike): Promise<FulfilResult> {
  const ref = orderIdFromSession(session);
  if (!ref.ok) {
    // A session with no reference is not one of ours (another integration on
    // the same Stripe account). Two references that disagree is something
    // wrong with ours: fail loudly so it shows in Stripe's webhook log.
    return ref.conflict
      ? { status: 500, body: { error: ref.reason } }
      : { status: 200, body: { ignored: ref.reason } };
  }

  if (session.payment_status !== 'paid') {
    return { status: 200, body: { waiting: `payment_status is ${session.payment_status}` } };
  }

  const order = await deps.getOrder(ref.orderId);
  if (!order) {
    return { status: 500, body: { error: `paid session ${session.id} names order ${ref.orderId}, which does not exist` } };
  }

  let shipping: ShippingRecord | null = null;
  let addressProblem: string | null = null;
  try {
    shipping = shippingFromSession(session);
  } catch (e) {
    addressProblem = msg(e);
  }

  // The money has moved whatever happens next, so the payment is recorded first.
  await deps.markPaid(order.id, {
    stripeSessionId: session.id,
    email: session.customer_details?.email ?? null,
    marketingOptIn: marketingOptIn(session),
    shipping,
  });

  const amiss = amountProblem(order, session);
  if (amiss) {
    await deps.noteError(order.id, `HELD, not sent to Gelato: ${amiss}`);
    return { status: 200, body: { held: amiss } };
  }

  const claimed = await deps.claim(order.id);
  if (!claimed) {
    const now = await deps.getOrder(order.id);
    const status = now?.status ?? 'missing';
    if (status === 'submitting') {
      return { status: 503, body: { retry: 'another delivery is sending this order to Gelato, or its outcome is being checked' } };
    }
    if ((WITH_GELATO as readonly string[]).includes(status)) {
      return { status: 200, body: { done: 'already with Gelato', gelato_order_id: now?.gelato_order_id ?? null } };
    }
    if (status === 'cancelled') return { status: 200, body: { done: 'order was cancelled' } };
    return { status: 500, body: { error: `could not claim order ${order.id} in status ${status}` } };
  }

  // This delivery owns the order. Anything that fails before the request
  // leaves for Gelato means nothing was created there: fulfilment_failed.
  let payload: GelatoOrderRequest;
  try {
    if (addressProblem || !shipping) throw new Error(addressProblem ?? 'no shipping address');
    const product = await deps.getProduct(claimed.product);
    const uid = product?.gelato_product_uid?.trim();
    if (!uid) throw new Error(`product ${claimed.product} has no Gelato product UID`);
    const fileUrl = await deps.signedFileUrl(claimed.print_file_path);
    payload = buildGelatoOrder({
      orderId: claimed.id,
      productUid: uid,
      fileUrl,
      address: toGelatoAddress(shipping),
      orderType: deps.orderType,
    });
  } catch (e) {
    const why = `not sent to Gelato: ${msg(e)}`;
    await deps.markFailed(claimed.id, why);
    return { status: 500, body: { error: why } };
  }

  let outcome: GelatoOutcome;
  try {
    outcome = await deps.createGelatoOrder(payload);
  } catch (e) {
    outcome = gelatoNetworkFailure(e);
  }

  if (outcome.kind === 'created') {
    try {
      await deps.markSubmitted(claimed.id, outcome.gelatoOrderId);
    } catch (e) {
      // Gelato has it and we could not write that down. The order stays
      // 'submitting', which nothing resends; the 500 keeps it visible in
      // Stripe's webhook log with the Gelato id in it.
      return {
        status: 500,
        body: { error: `Gelato order ${outcome.gelatoOrderId} created but not recorded (${msg(e)}); it will not be resent` },
      };
    }
    return { status: 200, body: { gelato_order_id: outcome.gelatoOrderId, order_type: payload.orderType } };
  }

  if (outcome.kind === 'rejected') {
    await deps.markFailed(claimed.id, outcome.message);
    return { status: 500, body: { error: outcome.message } };
  }

  await deps.noteError(
    claimed.id,
    `OUTCOME UNKNOWN, left in submitting: ${outcome.message} Check Gelato for orderReferenceId ${claimed.id}, then set in_production (with gelato_order_id) or fulfilment_failed.`,
  );
  return { status: 500, body: { error: outcome.message } };
}
