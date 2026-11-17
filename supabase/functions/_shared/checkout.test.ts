import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSellable,
  checkoutIdempotencyKey,
  checkoutSessionParams,
  existingSessionDecision,
  isPromotionsConsentRefusal,
  orderIdFromSession,
  withoutPromotionsConsent,
  printFileReady,
  returnUrls,
  type ProductRow,
} from './checkout.ts';
import { SHIP_TO_COUNTRIES } from './address.ts';
import { BadRequest } from './validate.ts';

const ID = '3f1c2a9e-8b7d-4c6e-9a5f-0123456789ab';
const mug: ProductRow = {
  slug: 'mug',
  name: 'Mug',
  price_cents: 2400,
  currency: 'aud',
  gelato_product_uid: 'mug_uid',
  print_width_px: 2475,
  print_height_px: 1155,
  active: true,
};

test('checkout refuses, with a clear sentence, while a product has no Gelato product UID', () => {
  assert.throws(
    () => assertSellable({ ...mug, gelato_product_uid: null }),
    (e: unknown) => e instanceof BadRequest && e.status === 409 && /isn't connected to our printer/.test(e.message),
  );
  assert.throws(() => assertSellable({ ...mug, gelato_product_uid: '  ' }), BadRequest);
  assert.throws(() => assertSellable({ ...mug, active: false }), BadRequest);
  assert.throws(() => assertSellable(null), BadRequest);
  assert.throws(() => assertSellable({ ...mug, price_cents: 0 }), BadRequest);
  assert.doesNotThrow(() => assertSellable(mug));
});

test('the Checkout Session is priced from the product row, in AUD, worldwide shipping, phone and consent collected', () => {
  const p = checkoutSessionParams({ id: ID, look: 'screen_print' }, mug, 'https://littlemasterpiece.com.au');
  assert.equal(p.mode, 'payment');
  assert.equal(p.currency, 'aud');
  assert.equal(p.line_items.length, 1);
  assert.equal(p.line_items[0].quantity, 1);
  assert.equal(p.line_items[0].price_data.unit_amount, 2400);
  assert.equal(p.line_items[0].price_data.currency, 'aud');
  assert.equal(p.line_items[0].price_data.product_data.name, 'Mug');
  assert.match(p.line_items[0].price_data.product_data.description, /^Screen print/);
  assert.deepEqual(p.shipping_address_collection.allowed_countries, [...SHIP_TO_COUNTRIES]);
  assert.deepEqual(p.phone_number_collection, { enabled: true });
  assert.deepEqual(p.consent_collection, { promotions: 'auto' });
  assert.equal(p.client_reference_id, ID);
  assert.deepEqual(p.metadata, { order_id: ID });
  assert.deepEqual(p.payment_intent_data, { metadata: { order_id: ID } });
});

test('changing the product row price changes the charge; nothing else can', () => {
  const dearer = checkoutSessionParams({ id: ID, look: 'as_drawn' }, { ...mug, price_cents: 2900 }, 'https://x.example');
  assert.equal(dearer.line_items[0].price_data.unit_amount, 2900);
  // The order argument carries no price field at all, so a tampered body has nowhere to land.
  const sneaky = { id: ID, look: 'as_drawn' as const, price_cents: 1, amount_cents: 1 };
  assert.equal(checkoutSessionParams(sneaky, mug, 'https://x.example').line_items[0].price_data.unit_amount, 2400);
});

test('success_url keeps {CHECKOUT_SESSION_ID} unencoded for Stripe to fill in', () => {
  assert.deepEqual(returnUrls('https://littlemasterpiece.com.au'), {
    success: 'https://littlemasterpiece.com.au/?session_id={CHECKOUT_SESSION_ID}',
    cancel: 'https://littlemasterpiece.com.au/?checkout=cancelled',
  });
  assert.equal(returnUrls('https://x.example/shop/').success, 'https://x.example/shop/?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(returnUrls('http://localhost:5173').cancel, 'http://localhost:5173/?checkout=cancelled');
  assert.throws(() => returnUrls('http://littlemasterpiece.com.au'), /https/);
});

test('a Stripe refusal of promotions consent (US merchants only) is recognised, and only that', () => {
  assert.equal(isPromotionsConsentRefusal({ type: 'StripeInvalidRequestError', param: 'consent_collection[promotions]' }), true);
  assert.equal(
    isPromotionsConsentRefusal({ type: 'StripeInvalidRequestError', message: 'consent_collection is not available in AU' }),
    true,
  );
  assert.equal(isPromotionsConsentRefusal({ type: 'StripeInvalidRequestError', param: 'line_items[0][price_data]' }), false);
  assert.equal(isPromotionsConsentRefusal({ type: 'StripeAPIError', param: 'consent_collection' }), false);
  assert.equal(isPromotionsConsentRefusal(new Error('network')), false);
  assert.equal(isPromotionsConsentRefusal(null), false);
  const p = checkoutSessionParams({ id: ID, look: 'as_drawn' }, mug, 'https://x.example');
  const bare = withoutPromotionsConsent(p);
  assert.equal('consent_collection' in bare, false);
  assert.equal(bare.line_items[0].price_data.unit_amount, 2400, 'everything else unchanged');
  assert.deepEqual(bare.shipping_address_collection, p.shipping_address_collection);
});

test('a double tap gets the same idempotency key, a new price or session gets a new one', () => {
  const a = checkoutIdempotencyKey(ID, null, 2400);
  assert.equal(a, checkoutIdempotencyKey(ID, null, 2400));
  assert.notEqual(a, checkoutIdempotencyKey(ID, null, 2900));
  assert.notEqual(a, checkoutIdempotencyKey(ID, 'cs_test_old', 2400));
});

test('an existing session is reused only while open at the current price', () => {
  assert.equal(existingSessionDecision({ status: 'open', amount_total: 2400, currency: 'aud' }, 2400), 'reuse');
  assert.equal(existingSessionDecision({ status: 'open', amount_total: 2000, currency: 'aud' }, 2400), 'replace_expire');
  assert.equal(existingSessionDecision({ status: 'complete', amount_total: 2400, currency: 'aud' }, 2400), 'paid');
  assert.equal(existingSessionDecision({ status: 'expired', amount_total: 2400, currency: 'aud' }, 2400), 'replace');
});

test('checkout needs a non-empty print file in the order folder', () => {
  const path = `orders/${ID}/print.png`;
  assert.equal(printFileReady([{ name: 'print.png', metadata: { size: 1234 } }], path), true);
  assert.equal(printFileReady([{ name: 'print.png', metadata: { size: 0 } }], path), false);
  assert.equal(printFileReady([{ name: 'other.png', metadata: { size: 9 } }], path), false);
  assert.equal(printFileReady([], path), false);
  assert.equal(printFileReady(null, path), false);
});

test('the order a session is for comes from our own two references, which must agree', () => {
  assert.deepEqual(orderIdFromSession({ client_reference_id: ID, metadata: { order_id: ID } }), { ok: true, orderId: ID });
  assert.deepEqual(orderIdFromSession({ client_reference_id: null, metadata: { order_id: ID.toUpperCase() } }), { ok: true, orderId: ID });
  const conflict = orderIdFromSession({ client_reference_id: ID, metadata: { order_id: 'aaaaaaaa-8b7d-4c6e-9a5f-0123456789ab' } });
  assert.equal(conflict.ok, false);
  assert.equal(!conflict.ok && conflict.conflict, true);
  const none = orderIdFromSession({ client_reference_id: null, metadata: {} });
  assert.equal(!none.ok && none.conflict, false);
  assert.equal(orderIdFromSession({ client_reference_id: 'abc' }).ok, false);
});
