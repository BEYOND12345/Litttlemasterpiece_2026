/**
 * Stripe webhook signature check. An endpoint that skips this is a
 * free-print endpoint: anyone could POST a "checkout.session.completed".
 *
 * The SDK's own `webhooks` object is passed in (stripe-webhook passes the
 * Deno one, webhook.test.ts passes the same stripe@18.5.0 from node_modules),
 * so the exact call the function makes is the call the test makes. It must
 * be given the RAW body text: re-serialised JSON changes the bytes and fails.
 *
 * Pure: no Deno, no Stripe import.
 */

export interface WebhooksLike<E, P> {
  constructEventAsync(payload: string, header: string, secret: string, tolerance?: number, cryptoProvider?: P): Promise<E>;
}

/** Stripe's default: a signed event older than five minutes is refused (replay window). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type Verified<E> = { ok: true; event: E } | { ok: false; reason: string };

export async function verifyStripeEvent<E, P>(
  webhooks: WebhooksLike<E, P>,
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  cryptoProvider: P,
): Promise<Verified<E>> {
  if (!secret) return { ok: false, reason: 'webhook secret is not configured' };
  if (!signatureHeader) return { ok: false, reason: 'missing Stripe-Signature header' };
  try {
    const event = await webhooks.constructEventAsync(
      rawBody,
      signatureHeader,
      secret,
      SIGNATURE_TOLERANCE_SECONDS,
      cryptoProvider,
    );
    return { ok: true, event };
  } catch (e) {
    return { ok: false, reason: `signature check failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** The events that can mean "paid". Everything else is acknowledged and ignored. */
export const FULFIL_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'] as const;
export const isFulfilEvent = (type: string): boolean => (FULFIL_EVENTS as readonly string[]).includes(type);
