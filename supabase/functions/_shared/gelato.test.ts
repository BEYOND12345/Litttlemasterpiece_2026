import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GELATO_ORDERS_URL,
  buildGelatoOrder,
  gelatoNetworkFailure,
  gelatoOrderType,
  gelatoStatusUpdate,
  interpretGelatoResponse,
  parseGelatoStatusEvent,
} from './gelato.ts';

const ID = '3f1c2a9e-8b7d-4c6e-9a5f-0123456789ab';
const address = {
  firstName: 'Jane',
  lastName: 'Citizen',
  addressLine1: '12 Wattle St',
  city: 'Newtown',
  postCode: '2042',
  state: 'NSW',
  country: 'AU',
  email: 'parent@example.com',
};

test('drafts unless GELATO_ORDER_TYPE is exactly "order"', () => {
  assert.equal(gelatoOrderType('order'), 'order');
  for (const v of [undefined, null, '', 'draft', 'Order', 'ORDER', ' order', 'orders', 'true']) {
    assert.equal(gelatoOrderType(v), 'draft', String(v));
  }
});

test('builds the v4 order the brief specifies', () => {
  assert.equal(GELATO_ORDERS_URL, 'https://order.gelatoapis.com/v4/orders');
  const body = buildGelatoOrder({
    orderId: ID,
    productUid: 'framed_poster_placeholder_uid',
    fileUrl: 'https://proj.supabase.co/storage/v1/object/sign/print-files/orders/x/print.png?token=t',
    address,
    orderType: 'draft',
  });
  assert.deepEqual(body, {
    orderType: 'draft',
    orderReferenceId: ID,
    customerReferenceId: ID,
    currency: 'AUD',
    items: [
      {
        itemReferenceId: `${ID}-1`,
        productUid: 'framed_poster_placeholder_uid',
        files: [{ type: 'default', url: 'https://proj.supabase.co/storage/v1/object/sign/print-files/orders/x/print.png?token=t' }],
        quantity: 1,
      },
    ],
    shippingAddress: address,
  });
});

test('refuses to build an order with no product or a non-https file', () => {
  assert.throws(() => buildGelatoOrder({ orderId: ID, productUid: ' ', fileUrl: 'https://x', address, orderType: 'draft' }));
  assert.throws(() => buildGelatoOrder({ orderId: ID, productUid: 'u', fileUrl: 'http://x', address, orderType: 'draft' }));
});

test("reads Gelato's answer: created only with an id, rejected on an error status, unknown otherwise", () => {
  assert.deepEqual(interpretGelatoResponse(200, JSON.stringify({ id: 'g-123', fulfillmentStatus: 'draft' })), {
    kind: 'created',
    gelatoOrderId: 'g-123',
  });
  assert.equal(interpretGelatoResponse(201, '{"id":"g-1"}').kind, 'created');
  assert.equal(interpretGelatoResponse(200, '{}').kind, 'unknown', '2xx without an id may still be an order');
  assert.equal(interpretGelatoResponse(200, '<html>').kind, 'unknown');
  const rejected = interpretGelatoResponse(400, JSON.stringify({ message: 'Invalid productUid' }));
  assert.deepEqual(rejected, { kind: 'rejected', message: 'Gelato 400: Invalid productUid' });
  assert.equal(interpretGelatoResponse(503, 'Service Unavailable').kind, 'rejected');
  assert.equal(gelatoNetworkFailure(new Error('timed out')).kind, 'unknown');
});

test("parses Gelato's order_status_updated webhook and ignores anything else", () => {
  const event = { id: 'os_1', event: 'order_status_updated', orderId: 'g-123', orderReferenceId: ID, fulfillmentStatus: 'shipped' };
  assert.deepEqual(parseGelatoStatusEvent(event), { orderReferenceId: ID, gelatoOrderId: 'g-123', fulfillmentStatus: 'shipped' });
  assert.equal(parseGelatoStatusEvent({ ...event, event: 'order_item_status_updated' }), null);
  assert.equal(parseGelatoStatusEvent({ ...event, orderId: 5 }), null);
  assert.equal(parseGelatoStatusEvent(null), null);
});

test('a Gelato status event moves only the order it names, and only forward', () => {
  const ev = (fulfillmentStatus: string, gelatoOrderId = 'g-123') => ({ orderReferenceId: ID, gelatoOrderId, fulfillmentStatus });
  assert.deepEqual(gelatoStatusUpdate({ status: 'in_production', gelato_order_id: 'g-123' }, ev('shipped')), {
    matches: true,
    gelato_status: 'shipped',
    status: 'shipped',
  });
  assert.deepEqual(gelatoStatusUpdate({ status: 'in_production', gelato_order_id: 'g-123' }, ev('shipped', 'g-999')), {
    matches: false,
  });
  assert.deepEqual(gelatoStatusUpdate({ status: 'paid', gelato_order_id: null }, ev('shipped')), { matches: false });
  // Recorded, but not a move: printed is not a status of ours; delivered cannot go back to shipped.
  assert.equal((gelatoStatusUpdate({ status: 'in_production', gelato_order_id: 'g-123' }, ev('printed')) as { status: unknown }).status, null);
  assert.equal((gelatoStatusUpdate({ status: 'delivered', gelato_order_id: 'g-123' }, ev('shipped')) as { status: unknown }).status, null);
  assert.equal((gelatoStatusUpdate({ status: 'shipped', gelato_order_id: 'g-123' }, ev('delivered')) as { status: unknown }).status, 'delivered');
});
