import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKOUT_STEPS, isStripeCheckoutUrl, readCheckoutReturn, statusCopy } from './checkoutLogic.ts';

test('only Stripe Checkout URLs are followed', () => {
  assert.equal(isStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_a1b2#fid'), true);
  for (const u of [
    'http://checkout.stripe.com/c/pay/cs_test',
    'https://checkout.stripe.com.evil.example/c/pay',
    'https://evil.example/?u=https://checkout.stripe.com',
    'javascript:alert(1)',
    '',
    null,
    42,
  ]) {
    assert.equal(isStripeCheckoutUrl(u), false, String(u));
  }
});

test("reads Stripe's way back: paid with a session id, or cancelled", () => {
  assert.deepEqual(readCheckoutReturn('?session_id=cs_test_a1B2c3D4e5F6'), { kind: 'paid', sessionId: 'cs_test_a1B2c3D4e5F6' });
  assert.deepEqual(readCheckoutReturn('?checkout=cancelled'), { kind: 'cancelled' });
  assert.equal(readCheckoutReturn('?session_id={CHECKOUT_SESSION_ID}'), null, 'an unfilled template is not a session');
  assert.equal(readCheckoutReturn('?session_id=<script>'), null);
  assert.equal(readCheckoutReturn(''), null);
});

test('the return page never says paid before the webhook has recorded it', () => {
  assert.doesNotMatch(statusCopy('pending').title, /paid/i);
  assert.equal(statusCopy('pending').settled, false);
  assert.equal(statusCopy('paid').settled, false);
  assert.equal(statusCopy('submitting').settled, false);
  for (const s of ['in_production', 'shipped', 'delivered', 'cancelled', 'fulfilment_failed']) {
    assert.equal(statusCopy(s).settled, true, s);
  }
});

test('progress steps are in the order checkout.ts runs them', () => {
  assert.deepEqual(CHECKOUT_STEPS.map((s) => s.id), ['order', 'print', 'upload', 'pay']);
});
