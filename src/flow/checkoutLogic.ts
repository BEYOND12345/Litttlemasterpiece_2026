/**
 * The decisions in the browser half of checkout, with no DOM and no network
 * (checkoutLogic.test.ts). checkout.ts and the return page use them.
 */

/** Only ever send the parent to Stripe's own Checkout page. */
export function isStripeCheckoutUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'checkout.stripe.com';
  } catch {
    return false;
  }
}

export type CheckoutReturn = { kind: 'paid'; sessionId: string } | { kind: 'cancelled' } | null;

/** What Stripe's redirect back (success_url / cancel_url in create-checkout) is saying. */
export function readCheckoutReturn(search: string): CheckoutReturn {
  const q = new URLSearchParams(search);
  const sid = q.get('session_id');
  if (sid && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sid)) return { kind: 'paid', sessionId: sid };
  if (q.get('checkout') === 'cancelled') return { kind: 'cancelled' };
  return null;
}

/** Steps the parent watches between pressing Order and landing on Stripe. */
export type CheckoutStep = 'order' | 'print' | 'upload' | 'pay';

export const CHECKOUT_STEPS: { id: CheckoutStep; label: string }[] = [
  { id: 'order', label: 'Saving your order' },
  { id: 'print', label: 'Making the full-size print file' },
  { id: 'upload', label: 'Sending it to us' },
  { id: 'pay', label: 'Opening secure payment' },
];

/** The order's status, as a parent should read it. Never claims more than the status says. */
export function statusCopy(status: string): { title: string; body: string; settled: boolean } {
  switch (status) {
    case 'pending':
      return {
        title: 'Confirming your payment',
        body: 'Stripe has sent you back to us. We are waiting for its confirmation, which usually takes a few seconds.',
        settled: false,
      };
    case 'paid':
    case 'submitting':
      return { title: 'Paid, thank you', body: 'We are sending your order to our printer now.', settled: false };
    case 'fulfilment_failed':
      return {
        title: 'Paid, thank you',
        body: 'Your payment went through. Sending the order to our printer is taking longer than usual; it is in hand and there is nothing more you need to do.',
        settled: true,
      };
    case 'in_production':
      return { title: 'Paid, and with our printer', body: 'Your gift is being made.', settled: true };
    case 'shipped':
      return { title: 'On its way', body: 'Your gift has been sent.', settled: true };
    case 'delivered':
      return { title: 'Delivered', body: 'Your gift has arrived.', settled: true };
    case 'cancelled':
      return { title: 'This order was cancelled', body: 'It will not be printed or sent.', settled: true };
    default:
      return { title: 'Order received', body: 'We have your order.', settled: true };
  }
}

/** The return page re-checks while the order is still moving, a bounded number of times. */
export const STATUS_POLL_MS = 3000;
export const STATUS_POLL_MAX = 10;
