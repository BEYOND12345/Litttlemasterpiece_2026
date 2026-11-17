/**
 * The signature check, run through the REAL Stripe SDK (the stripe@18.5.0
 * devDependency, the version stripe-webhook imports as npm:stripe@18.5.0)
 * with the same SubtleCrypto provider the Deno function uses. Signatures
 * are made locally with the SDK's own test-header helper and a made-up
 * secret: this proves the call accepts what Stripe's scheme signs and
 * refuses everything else. It has not been run against an event Stripe sent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { isFulfilEvent, verifyStripeEvent } from './webhook.ts';

const stripe = new Stripe('sk_test_not_a_real_key_only_for_local_signing');
const crypto = Stripe.createSubtleCryptoProvider();
const SECRET = 'whsec_local_test_secret_not_real';

const payload = JSON.stringify({
  id: 'evt_test_1',
  object: 'event',
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_test_abc', object: 'checkout.session', payment_status: 'paid' } },
});

const sign = (body: string, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) =>
  stripe.webhooks.generateTestHeaderStringAsync({ payload: body, secret, timestamp, cryptoProvider: crypto });

test('accepts a correctly signed raw body', async () => {
  const r = await verifyStripeEvent<Stripe.Event, Stripe.CryptoProvider>(stripe.webhooks, payload, await sign(payload), SECRET, crypto);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.event.type, 'checkout.session.completed');
});

test('refuses a body changed after signing (e.g. payment_status flipped, amount edited)', async () => {
  const header = await sign(payload);
  const tampered = payload.replace('"paid"', '"paid" ');
  const r = await verifyStripeEvent(stripe.webhooks, tampered, header, SECRET, crypto);
  assert.equal(r.ok, false);
});

test('refuses re-serialised JSON: the function must verify the raw text', async () => {
  const header = await sign(payload);
  const reserialised = JSON.stringify(JSON.parse(payload), null, 2);
  assert.equal((await verifyStripeEvent(stripe.webhooks, reserialised, header, SECRET, crypto)).ok, false);
});

test('refuses a signature made with another secret', async () => {
  const header = await sign(payload, 'whsec_someone_else');
  assert.equal((await verifyStripeEvent(stripe.webhooks, payload, header, SECRET, crypto)).ok, false);
});

test('refuses a replay older than the tolerance', async () => {
  const header = await sign(payload, SECRET, Math.floor(Date.now() / 1000) - 3600);
  const r = await verifyStripeEvent(stripe.webhooks, payload, header, SECRET, crypto);
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.reason : '', /tolerance|timestamp/i);
});

test('refuses no header, a junk header, and a missing secret', async () => {
  assert.equal((await verifyStripeEvent(stripe.webhooks, payload, null, SECRET, crypto)).ok, false);
  assert.equal((await verifyStripeEvent(stripe.webhooks, payload, 't=1,v1=deadbeef', SECRET, crypto)).ok, false);
  assert.equal((await verifyStripeEvent(stripe.webhooks, payload, await sign(payload), '', crypto)).ok, false);
});

test('only the two "paid" events lead to fulfilment', () => {
  assert.equal(isFulfilEvent('checkout.session.completed'), true);
  assert.equal(isFulfilEvent('checkout.session.async_payment_succeeded'), true);
  for (const t of ['checkout.session.expired', 'checkout.session.async_payment_failed', 'payment_intent.succeeded', 'charge.succeeded']) {
    assert.equal(isFulfilEvent(t), false, t);
  }
});
