/**
 * The Gelato v4 order: building the request and reading the answer.
 * Only stripe-webhook sends it, and only after a verified, paid session and a
 * won claim (fulfil.ts).
 *
 * Pure: no Deno, no network. The fetch lives in _runtime/gelato.ts.
 */
import type { GelatoAddress } from './address.ts';
import { canTransition, statusFromGelato, type OrderStatus } from './status.ts';

export const GELATO_ORDERS_URL = 'https://order.gelatoapis.com/v4/orders';

export type GelatoOrderType = 'draft' | 'order';

/**
 * Drafts unless GELATO_ORDER_TYPE is exactly "order". A draft is created in
 * Gelato's dashboard and costs nothing until someone confirms it there, so a
 * typo, an unset variable or "Order" all stay safe.
 */
export function gelatoOrderType(env: string | null | undefined): GelatoOrderType {
  return env === 'order' ? 'order' : 'draft';
}

/** How long Gelato's link to the print file lives. Drafts may be confirmed days later. */
export const PRINT_FILE_URL_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface GelatoOrderRequest {
  orderType: GelatoOrderType;
  orderReferenceId: string;
  customerReferenceId: string;
  currency: 'AUD';
  items: Array<{
    itemReferenceId: string;
    productUid: string;
    files: Array<{ type: 'default'; url: string }>;
    quantity: 1;
  }>;
  shippingAddress: GelatoAddress;
}

export function buildGelatoOrder(input: {
  orderId: string;
  productUid: string;
  fileUrl: string;
  address: GelatoAddress;
  orderType: GelatoOrderType;
}): GelatoOrderRequest {
  if (!input.productUid.trim()) throw new Error('No Gelato product UID');
  if (!/^https:\/\//.test(input.fileUrl)) throw new Error('Print file URL must be https');
  return {
    orderType: input.orderType,
    // Our order id, so a Gelato order can always be traced back, and a
    // person checking a stuck 'submitting' order can search Gelato for it.
    orderReferenceId: input.orderId,
    // There are no customer accounts; the order id is the only stable
    // reference that carries no personal data.
    customerReferenceId: input.orderId,
    currency: 'AUD',
    items: [
      {
        itemReferenceId: `${input.orderId}-1`,
        productUid: input.productUid,
        files: [{ type: 'default', url: input.fileUrl }],
        quantity: 1,
      },
    ],
    shippingAddress: input.address,
  };
}

/**
 * What Gelato's answer means for whether an order now exists there.
 *  - created:  2xx with an id. Record it; never send again.
 *  - rejected: Gelato answered with an error status. Treated as "nothing
 *              created", so the order may be retried.
 *  - unknown:  no answer, or a 2xx we cannot read. Gelato may have the order;
 *              the order stays 'submitting' and a person checks.
 */
export type GelatoOutcome =
  | { kind: 'created'; gelatoOrderId: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'unknown'; message: string };

export function interpretGelatoResponse(httpStatus: number, bodyText: string): GelatoOutcome {
  let body: unknown = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = null;
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    const id = body && typeof body === 'object' ? (body as { id?: unknown }).id : undefined;
    if (typeof id === 'string' && id.trim()) return { kind: 'created', gelatoOrderId: id };
    return {
      kind: 'unknown',
      message: `Gelato answered ${httpStatus} without an order id; it may have created the order. Body: ${bodyText.slice(0, 300)}`,
    };
  }
  const detail =
    body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
      ? (body as { message: string }).message
      : bodyText.slice(0, 300);
  return { kind: 'rejected', message: `Gelato ${httpStatus}: ${detail}` };
}

export function gelatoNetworkFailure(err: unknown): GelatoOutcome {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return {
    kind: 'unknown',
    message: `No answer from Gelato (${msg}); it may have received the order.`,
  };
}

/**
 * Gelato's order_status_updated webhook, as gelato-webhook receives it. It
 * only ever moves an order we already sent FORWARD (in_production -> shipped
 * -> delivered, or cancelled); it can never create, resend or re-price one.
 */
export interface GelatoStatusEvent {
  orderReferenceId: string;
  gelatoOrderId: string;
  fulfillmentStatus: string;
}

export function parseGelatoStatusEvent(body: unknown): GelatoStatusEvent | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.event !== 'order_status_updated') return null;
  const { orderReferenceId, orderId, fulfillmentStatus } = b;
  if (typeof orderReferenceId !== 'string' || typeof orderId !== 'string' || typeof fulfillmentStatus !== 'string') {
    return null;
  }
  return { orderReferenceId, gelatoOrderId: orderId, fulfillmentStatus };
}

/**
 * What a Gelato status event changes on our row. The raw status is always
 * kept; our status moves only along an allowed transition, and only when the
 * event is for the Gelato order we recorded.
 */
export function gelatoStatusUpdate(
  order: { status: OrderStatus; gelato_order_id: string | null },
  event: GelatoStatusEvent,
): { matches: false } | { matches: true; gelato_status: string; status: OrderStatus | null } {
  if (!order.gelato_order_id || order.gelato_order_id !== event.gelatoOrderId) return { matches: false };
  const next = statusFromGelato(event.fulfillmentStatus);
  const status = next && next !== order.status && canTransition(order.status, next) ? next : null;
  return { matches: true, gelato_status: event.fulfillmentStatus, status };
}
