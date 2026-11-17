/**
 * The order status machine. The same list is enforced in the database by
 * gift_orders_guard (supabase/migrations/20261117000000_christmas_checkout.sql);
 * status.test.ts reads that migration and fails if the two disagree.
 *
 * Pure: no Deno, no network. Imported by the Edge Functions and by Node tests.
 */

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'submitting',
  'fulfilment_failed',
  'in_production',
  'shipped',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: ReadonlyArray<readonly [OrderStatus, OrderStatus]> = [
  ['pending', 'paid'],
  ['paid', 'submitting'],
  ['fulfilment_failed', 'submitting'],
  ['submitting', 'in_production'],
  ['submitting', 'fulfilment_failed'],
  ['in_production', 'shipped'],
  ['in_production', 'delivered'],
  ['shipped', 'delivered'],
  ['paid', 'cancelled'],
  ['fulfilment_failed', 'cancelled'],
  ['in_production', 'cancelled'],
];

/**
 * The statuses a webhook delivery may claim an order FROM (claim_gift_order).
 * 'submitting' is deliberately absent: an order in flight, or left in flight
 * by a crash, is never sent to Gelato a second time by the code.
 */
export const CLAIMABLE_FROM: readonly OrderStatus[] = ['paid', 'fulfilment_failed'];

/** Gelato has the order. Nothing more for the payment path to do. */
export const WITH_GELATO: readonly OrderStatus[] = ['in_production', 'shipped', 'delivered'];

export const isOrderStatus = (s: unknown): s is OrderStatus =>
  typeof s === 'string' && (ORDER_STATUSES as readonly string[]).includes(s);

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS.some(([a, b]) => a === from && b === to);
}

/**
 * Gelato's fulfillmentStatus, as sent by its order_status_updated webhook, to
 * ours. Anything not listed (created, passed, printed, on_hold, ...) changes
 * nothing; the raw text is still stored in gift_orders.gelato_status.
 */
export function statusFromGelato(fulfillmentStatus: unknown): OrderStatus | null {
  if (typeof fulfillmentStatus !== 'string') return null;
  switch (fulfillmentStatus.trim().toLowerCase()) {
    case 'shipped':
    case 'in_transit':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    case 'canceled':
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}
