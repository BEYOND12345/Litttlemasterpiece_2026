import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BadRequest,
  isCheckoutSessionId,
  isUuid,
  parseCreateCheckout,
  parseCreateOrder,
  parseOrderStatus,
  safeEqual,
} from './validate.ts';
import { allowedOrigins, corsHeaders } from './cors.ts';

const ID = '3f1c2a9e-8b7d-4c6e-9a5f-0123456789ab';

test('create-order reads a product and a look, and nothing else (a price in the body is ignored)', () => {
  const parsed = parseCreateOrder({ product: 'mug', look: 'screen_print', price_cents: 1, amount: 1, currency: 'usd' });
  assert.deepEqual(parsed, { product: 'mug', look: 'screen_print' });
});

test('create-order refuses unknown looks and malformed products', () => {
  assert.throws(() => parseCreateOrder({ product: 'mug', look: 'watercolour' }), BadRequest);
  assert.throws(() => parseCreateOrder({ product: 'Mug; drop table', look: 'as_drawn' }), BadRequest);
  assert.throws(() => parseCreateOrder({ look: 'as_drawn' }), BadRequest);
  assert.throws(() => parseCreateOrder(null), BadRequest);
  assert.throws(() => parseCreateOrder([]), BadRequest);
});

test('create-checkout reads an order id and nothing else', () => {
  assert.deepEqual(parseCreateCheckout({ orderId: ID.toUpperCase(), price_cents: 1, unit_amount: 1 }), { orderId: ID });
  assert.throws(() => parseCreateCheckout({ orderId: 'not-a-uuid' }), BadRequest);
  assert.throws(() => parseCreateCheckout({}), BadRequest);
});

test('order-status takes only a Stripe Checkout Session id', () => {
  assert.deepEqual(parseOrderStatus({ sessionId: 'cs_test_a1B2c3D4e5F6g7H8' }), { sessionId: 'cs_test_a1B2c3D4e5F6g7H8' });
  assert.throws(() => parseOrderStatus({ sessionId: ID }), BadRequest);
  assert.throws(() => parseOrderStatus({ sessionId: "cs_test_x' or 1=1" }), BadRequest);
  assert.equal(isCheckoutSessionId('cs_live_ABCDEFGHIJKLMN'), true);
  assert.equal(isCheckoutSessionId('pi_123'), false);
  assert.equal(isUuid(ID), true);
  assert.equal(isUuid('3f1c2a9e8b7d4c6e9a5f0123456789ab'), false);
});

test('BadRequest carries its status', () => {
  assert.equal(new BadRequest('x').status, 400);
  assert.equal(new BadRequest('x', 409).status, 409);
});

test('safeEqual compares tokens exactly', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', 'a'), false);
  assert.equal(safeEqual('', ''), true);
});

test('CORS echoes an allowed origin and never echoes a stranger', () => {
  const allowed = allowedOrigins('https://littlemasterpiece.com.au/some/path', 'http://localhost:5173, not a url');
  assert.deepEqual(allowed, ['https://littlemasterpiece.com.au', 'http://localhost:5173']);
  assert.equal(corsHeaders('http://localhost:5173', allowed)['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.equal(corsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin'], 'https://littlemasterpiece.com.au');
  assert.equal(corsHeaders(null, allowed)['Access-Control-Allow-Origin'], 'https://littlemasterpiece.com.au');
  assert.match(corsHeaders(null, allowed)['Access-Control-Allow-Headers'], /authorization.*apikey.*content-type/);
  assert.throws(() => allowedOrigins('not a url'));
});
