/**
 * fulfil.ts against an IN-MEMORY store. What this proves: the order of
 * operations and the retry rules (one Gelato order per paid order, however
 * often or concurrently Stripe delivers; nothing sent for unpaid or held
 * orders; ambiguous outcomes never resent). What it does NOT prove: that
 * Postgres, Stripe or Gelato behave as the store and fakes assume. The
 * store's claim is atomic the way claim_gift_order's single UPDATE is, and
 * it refuses illegal status moves the way gift_orders_guard does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fulfilCheckoutSession, type FulfilDeps, type PaidDetails } from './fulfil.ts';
import type { OrderRow, ProductRow } from './checkout.ts';
import type { GelatoOrderRequest, GelatoOrderType, GelatoOutcome } from './gelato.ts';
import type { StripeSessionLike } from './address.ts';
import { CLAIMABLE_FROM, canTransition, type OrderStatus } from './status.ts';

const ID = '3f1c2a9e-8b7d-4c6e-9a5f-0123456789ab';

interface Row extends OrderRow {
  customer_email: string | null;
  marketing_opt_in: boolean;
  shipping: unknown;
  last_error: string | null;
  submit_attempts: number;
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

class Store {
  orders = new Map<string, Row>();
  products = new Map<string, ProductRow>();
  gelatoCalls: GelatoOrderRequest[] = [];
  gelato: (n: number) => Promise<GelatoOutcome> = async (n) => ({ kind: 'created', gelatoOrderId: `g-${n}` });
  failMarkSubmitted = false;
  orderType: GelatoOrderType = 'draft';

  constructor() {
    this.products.set('mug', {
      slug: 'mug',
      name: 'Mug',
      price_cents: 2400,
      currency: 'aud',
      gelato_product_uid: 'mug_uid',
      print_width_px: 2475,
      print_height_px: 1155,
      active: true,
    });
    this.orders.set(ID, {
      id: ID,
      product: 'mug',
      look: 'as_drawn',
      print_file_path: `orders/${ID}/print.png`,
      status: 'pending',
      stripe_session_id: 'cs_test_session0001',
      amount_cents: 2400,
      currency: 'aud',
      gelato_order_id: null,
      customer_email: null,
      marketing_opt_in: false,
      shipping: null,
      last_error: null,
      submit_attempts: 0,
    });
  }

  get order(): Row {
    return this.orders.get(ID)!;
  }

  private move(row: Row, to: OrderStatus) {
    if (!canTransition(row.status, to)) throw new Error(`guard: ${row.status} -> ${to}`);
    row.status = to;
  }

  deps(): FulfilDeps {
    return {
      orderType: this.orderType,
      getOrder: async (id) => {
        await tick();
        const r = this.orders.get(id);
        return r ? { ...r } : null;
      },
      getProduct: async (slug) => {
        await tick();
        const p = this.products.get(slug);
        return p ? { ...p } : null;
      },
      markPaid: async (id, paid: PaidDetails) => {
        await tick();
        const r = this.orders.get(id);
        if (!r || r.status !== 'pending') return false;
        this.move(r, 'paid');
        r.stripe_session_id = paid.stripeSessionId;
        r.customer_email = paid.email;
        r.marketing_opt_in = paid.marketingOptIn;
        r.shipping = paid.shipping;
        return true;
      },
      claim: async (id) => {
        await tick();
        // Check and set with no await between them: one statement, like the SQL.
        const r = this.orders.get(id);
        if (!r || !CLAIMABLE_FROM.includes(r.status)) return null;
        this.move(r, 'submitting');
        r.submit_attempts++;
        r.last_error = null;
        return { ...r };
      },
      markSubmitted: async (id, gid) => {
        await tick();
        if (this.failMarkSubmitted) throw new Error('database unreachable');
        const r = this.orders.get(id)!;
        if (r.status !== 'submitting') throw new Error('no longer submitting');
        this.move(r, 'in_production');
        r.gelato_order_id = gid;
      },
      markFailed: async (id, message) => {
        await tick();
        const r = this.orders.get(id)!;
        if (r.status !== 'submitting') return;
        this.move(r, 'fulfilment_failed');
        r.last_error = message;
      },
      noteError: async (id, message) => {
        await tick();
        this.orders.get(id)!.last_error = message;
      },
      signedFileUrl: async (path) => `https://proj.supabase.co/storage/v1/object/sign/print-files/${path}?token=t`,
      createGelatoOrder: async (payload) => {
        this.gelatoCalls.push(payload);
        await tick(5); // in flight long enough for a concurrent delivery to arrive
        return this.gelato(this.gelatoCalls.length);
      },
    };
  }
}

const paidSession = (over: Partial<StripeSessionLike> = {}): StripeSessionLike => ({
  id: 'cs_test_session0001',
  client_reference_id: ID,
  metadata: { order_id: ID },
  payment_status: 'paid',
  status: 'complete',
  amount_total: 2400,
  currency: 'aud',
  customer_details: { email: 'parent@example.com', phone: '+61400000000', name: 'Jane Citizen' },
  collected_information: {
    shipping_details: {
      name: 'Jane Citizen',
      address: { line1: '12 Wattle St', city: 'Newtown', state: 'NSW', postal_code: '2042', country: 'AU' },
    },
  },
  ...over,
});

test('acceptance 1: a paid session creates exactly one Gelato DRAFT and the order goes in_production', async () => {
  const s = new Store();
  const res = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(res.status, 200);
  assert.equal(s.gelatoCalls.length, 1);
  const sent = s.gelatoCalls[0];
  assert.equal(sent.orderType, 'draft');
  assert.equal(sent.orderReferenceId, ID);
  assert.equal(sent.currency, 'AUD');
  assert.equal(sent.items[0].productUid, 'mug_uid');
  assert.equal(sent.items[0].quantity, 1);
  assert.match(sent.items[0].files[0].url, /^https:\/\/.*print-files\/orders\/.*\/print\.png/);
  assert.equal(sent.shippingAddress.country, 'AU');
  assert.equal(sent.shippingAddress.email, 'parent@example.com');
  assert.equal(s.order.status, 'in_production');
  assert.equal(s.order.gelato_order_id, 'g-1');
  assert.equal(s.order.customer_email, 'parent@example.com');
  assert.equal(s.order.marketing_opt_in, false, 'no consent answer is a no');
});

test('GELATO_ORDER_TYPE=order sends a real order', async () => {
  const s = new Store();
  s.orderType = 'order';
  await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(s.gelatoCalls[0].orderType, 'order');
});

test('acceptance 2: an unpaid session (declined card, async payment pending) creates zero Gelato orders', async () => {
  for (const payment_status of ['unpaid', 'no_payment_required', null]) {
    const s = new Store();
    const res = await fulfilCheckoutSession(s.deps(), paidSession({ payment_status }));
    assert.equal(res.status, 200);
    assert.equal(s.gelatoCalls.length, 0, String(payment_status));
    assert.equal(s.order.status, 'pending');
  }
});

test('acceptance 3: the same event delivered twice, one after the other, creates one Gelato order', async () => {
  const s = new Store();
  const first = await fulfilCheckoutSession(s.deps(), paidSession());
  const second = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.done, 'already with Gelato');
  assert.equal(s.gelatoCalls.length, 1);
  assert.equal(s.order.submit_attempts, 1);
});

test('acceptance 3: the same event delivered twice AT ONCE creates one Gelato order; the loser asks Stripe to retry', async () => {
  const s = new Store();
  const results = await Promise.all([
    fulfilCheckoutSession(s.deps(), paidSession()),
    fulfilCheckoutSession(s.deps(), paidSession()),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 503]);
  assert.equal(s.gelatoCalls.length, 1);
  const retry = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(retry.status, 200);
  assert.equal(s.gelatoCalls.length, 1);
});

test('acceptance 4: Stripe charging a different amount than the order stored holds the order; nothing is sent', async () => {
  const s = new Store();
  const res = await fulfilCheckoutSession(s.deps(), paidSession({ amount_total: 100 }));
  assert.equal(res.status, 200);
  assert.ok(res.body.held);
  assert.equal(s.gelatoCalls.length, 0);
  assert.equal(s.order.status, 'paid', 'the payment is still recorded');
  assert.match(s.order.last_error ?? '', /HELD/);
  await fulfilCheckoutSession(s.deps(), paidSession({ amount_total: 100 }));
  assert.equal(s.gelatoCalls.length, 0, 'a redelivery is held too');
  await fulfilCheckoutSession(s.deps(), paidSession({ currency: 'usd' }));
  assert.equal(s.gelatoCalls.length, 0, 'wrong currency is held');
});

test('Gelato rejecting -> fulfilment_failed + 500; the retry claims again and succeeds', async () => {
  const s = new Store();
  s.gelato = async (n) => (n === 1 ? { kind: 'rejected', message: 'Gelato 400: bad file' } : { kind: 'created', gelatoOrderId: 'g-ok' });
  const first = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(first.status, 500);
  assert.equal(s.order.status, 'fulfilment_failed');
  assert.match(s.order.last_error ?? '', /bad file/);
  const retry = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(retry.status, 200);
  assert.equal(s.order.status, 'in_production');
  assert.equal(s.order.gelato_order_id, 'g-ok');
  assert.equal(s.gelatoCalls.length, 2, 'one rejected, one created');
});

test('no answer from Gelato -> stays submitting, never resent; retries get 503', async () => {
  const s = new Store();
  s.gelato = async () => ({ kind: 'unknown', message: 'No answer from Gelato (TimeoutError).' });
  const first = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(first.status, 500);
  assert.equal(s.order.status, 'submitting');
  assert.match(s.order.last_error ?? '', /OUTCOME UNKNOWN.*orderReferenceId/);
  for (let i = 0; i < 3; i++) assert.equal((await fulfilCheckoutSession(s.deps(), paidSession())).status, 503);
  assert.equal(s.gelatoCalls.length, 1);
});

test('a throwing Gelato client counts as unknown, not as failed', async () => {
  const s = new Store();
  s.gelato = async () => {
    throw new Error('socket hang up');
  };
  await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(s.order.status, 'submitting');
  assert.equal((await fulfilCheckoutSession(s.deps(), paidSession())).status, 503);
  assert.equal(s.gelatoCalls.length, 1);
});

test('a crash after Gelato success (recording fails) is never resubmitted', async () => {
  const s = new Store();
  s.failMarkSubmitted = true;
  const first = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(first.status, 500);
  assert.match(String(first.body.error), /g-1 created but not recorded/);
  assert.equal(s.order.status, 'submitting');
  s.failMarkSubmitted = false;
  assert.equal((await fulfilCheckoutSession(s.deps(), paidSession())).status, 503);
  assert.equal(s.gelatoCalls.length, 1);
});

test('a product whose Gelato UID was removed after payment fails before sending', async () => {
  const s = new Store();
  s.products.get('mug')!.gelato_product_uid = null;
  const res = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(res.status, 500);
  assert.equal(s.gelatoCalls.length, 0);
  assert.equal(s.order.status, 'fulfilment_failed');
  assert.match(s.order.last_error ?? '', /no Gelato product UID/);
});

test('a paid session without a deliverable address fails before sending, payment still recorded', async () => {
  const s = new Store();
  const res = await fulfilCheckoutSession(s.deps(), paidSession({ collected_information: { shipping_details: null } }));
  assert.equal(res.status, 500);
  assert.equal(s.gelatoCalls.length, 0);
  assert.equal(s.order.status, 'fulfilment_failed');
  assert.equal(s.order.stripe_session_id, 'cs_test_session0001');
});

test('marketing opt-in is stored only for an explicit opt_in', async () => {
  const yes = new Store();
  await fulfilCheckoutSession(yes.deps(), paidSession({ consent: { promotions: 'opt_in' } }));
  assert.equal(yes.order.marketing_opt_in, true);
  const no = new Store();
  await fulfilCheckoutSession(no.deps(), paidSession({ consent: { promotions: 'opt_out' } }));
  assert.equal(no.order.marketing_opt_in, false);
});

test('sessions that are not ours are ignored; conflicting references fail loudly; neither sends', async () => {
  const s = new Store();
  const notOurs = await fulfilCheckoutSession(s.deps(), paidSession({ client_reference_id: null, metadata: {} }));
  assert.equal(notOurs.status, 200);
  const conflict = await fulfilCheckoutSession(
    s.deps(),
    paidSession({ metadata: { order_id: 'aaaaaaaa-8b7d-4c6e-9a5f-0123456789ab' } }),
  );
  assert.equal(conflict.status, 500);
  const missing = await fulfilCheckoutSession(
    s.deps(),
    paidSession({ client_reference_id: 'bbbbbbbb-8b7d-4c6e-9a5f-0123456789ab', metadata: null }),
  );
  assert.equal(missing.status, 500);
  assert.equal(s.gelatoCalls.length, 0);
  assert.equal(s.order.status, 'pending');
});

test('a cancelled order is acknowledged and never sent', async () => {
  const s = new Store();
  await fulfilCheckoutSession(s.deps(), paidSession({ amount_total: 1 })); // paid, held
  s.order.status = 'cancelled';
  const res = await fulfilCheckoutSession(s.deps(), paidSession());
  assert.equal(res.status, 200);
  assert.equal(s.gelatoCalls.length, 0);
});
