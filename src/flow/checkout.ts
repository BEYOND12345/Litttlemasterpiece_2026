/**
 * The browser half of paying for a gift:
 *
 *   create-order   -> a pending order + a one-time upload URL + the print size
 *   makePrintFile  -> the PNG Gelato will print, from the original photo
 *   upload         -> straight into the PRIVATE print-files bucket
 *   create-checkout-> a Stripe Checkout Session priced by the server
 *   redirect       -> Stripe's page; the card never touches this site
 *
 * Nothing here knows a price, a key or Gelato. What the parent pays is
 * decided in create-checkout from the database; the price on the Order
 * button (src/flow/products.ts) is display only.
 */
import { FunctionsFetchError } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type { OrderSelection } from './MakeFlow';
import { type CheckoutStep, isStripeCheckoutUrl } from './checkoutLogic';
import { makePrintFile } from './printFile';

const PRINT_BUCKET = 'print-files';

/**
 * Ordering is on only when the build says so (VITE_CHECKOUT_LIVE=true), once
 * Stripe, Supabase and Gelato are set up (docs/PAYMENTS.md). Until then a
 * preview says plainly that ordering is off, instead of failing on a network
 * call and reading as broken.
 */
const CHECKOUT_LIVE = import.meta.env.VITE_CHECKOUT_LIVE === 'true';

/** Thrown when ordering is switched off, so the page can say so calmly instead of as a failure. */
export class CheckoutDisabledError extends Error {}

interface CreateOrderResponse {
  orderId: string;
  path: string;
  token: string;
  print: { width: number; height: number };
}

export interface OrderStatusResponse {
  product: string;
  look: string;
  status: string;
}

/** An Edge Function call that throws an Error carrying the server's own sentence. */
async function call<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data as T;
  if (error instanceof FunctionsFetchError) {
    throw new Error("We couldn't reach our server. Check your connection and try again.");
  }
  let message = '';
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const parsed = await ctx.json();
      if (parsed && typeof parsed.error === 'string') message = parsed.error;
    } catch {
      // Not JSON: the fallback below says it plainly.
    }
  }
  throw new Error(message || fallback);
}

export async function startCheckout(selection: OrderSelection, onStep: (step: CheckoutStep) => void): Promise<void> {
  if (!CHECKOUT_LIVE) {
    throw new CheckoutDisabledError(
      "This is a preview, so ordering isn't switched on yet. Nothing has been ordered or charged.",
    );
  }
  onStep('order');
  const order = await call<CreateOrderResponse>(
    'create-order',
    { product: selection.product, look: selection.look },
    "We couldn't start your order. Nothing has been charged. Please try again.",
  );

  onStep('print');
  let file: Blob;
  try {
    file = await makePrintFile(selection.photo, selection.look, selection.product, order.print, selection.decisions);
  } catch (e) {
    console.error('Print file failed:', e);
    throw new Error(
      "We couldn't make the full-size print file on this device. Nothing has been charged. Try again, or use a smaller photo.",
    );
  }

  onStep('upload');
  const { error: uploadError } = await supabase.storage
    .from(PRINT_BUCKET)
    .uploadToSignedUrl(order.path, order.token, file, { contentType: 'image/png', upsert: false });
  if (uploadError) {
    console.error('Print file upload failed:', uploadError);
    throw new Error("Your print file didn't finish uploading. Nothing has been charged. Please try again.");
  }

  onStep('pay');
  const { url } = await call<{ url: string }>(
    'create-checkout',
    { orderId: order.orderId },
    "We couldn't open payment. Nothing has been charged. Please try again.",
  );
  if (!isStripeCheckoutUrl(url)) throw new Error("We couldn't open payment. Nothing has been charged. Please try again.");
  window.location.assign(url);
}

export function getOrderStatus(sessionId: string): Promise<OrderStatusResponse> {
  return call<OrderStatusResponse>('order-status', { sessionId }, "We couldn't check your order right now.");
}
