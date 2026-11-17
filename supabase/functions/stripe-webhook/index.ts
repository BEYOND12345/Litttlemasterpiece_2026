/**
 * stripe-webhook: the ONLY place an order reaches Gelato.
 *
 *   1. Verify the Stripe-Signature over the raw body (constructEventAsync +
 *      SubtleCrypto). Unsigned or tampered: 400, nothing read, nothing sent.
 *   2. Only checkout.session.completed / async_payment_succeeded can mean
 *      "paid"; everything else is acknowledged with 200 and ignored.
 *   3. Re-read the session from Stripe by id (the event body is never trusted
 *      for payment status, amount or address).
 *   4. _shared/fulfil.ts: paid -> claim -> Gelato -> in_production.
 *
 * Deploy with --no-verify-jwt: Stripe sends no Supabase JWT; the signature is
 * the authentication. The status code is the retry signal: Stripe retries
 * anything that is not 2xx, for up to three days.
 */
import type Stripe from 'npm:stripe@18.5.0';
import { admin, requireEnv, stripeClient, stripeCrypto } from '../_runtime/clients.ts';
import { fulfilDeps } from '../_runtime/fulfilDeps.ts';
import { fulfilCheckoutSession } from '../_shared/fulfil.ts';
import { json } from '../_shared/http.ts';
import { isFulfilEvent, verifyStripeEvent } from '../_shared/webhook.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });

  let secret: string;
  try {
    secret = requireEnv('STRIPE_WEBHOOK_SECRET');
  } catch (e) {
    console.error('[stripe-webhook]', e);
    return json(500, { error: 'webhook secret not configured' });
  }

  const stripe = stripeClient();
  const rawBody = await req.text();
  const verified = await verifyStripeEvent<Stripe.Event, Stripe.CryptoProvider>(
    stripe.webhooks,
    rawBody,
    req.headers.get('stripe-signature'),
    secret,
    stripeCrypto,
  );
  if (!verified.ok) {
    console.warn('[stripe-webhook] rejected:', verified.reason);
    return json(400, { error: verified.reason });
  }
  const event = verified.event;

  if (!isFulfilEvent(event.type)) return json(200, { ignored: event.type });

  try {
    const sessionId = (event.data.object as { id?: unknown }).id;
    if (typeof sessionId !== 'string') return json(400, { error: 'event has no session id' });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const result = await fulfilCheckoutSession(fulfilDeps(admin()), session);
    const log = result.status >= 500 ? console.error : console.log;
    log('[stripe-webhook]', event.id, event.type, sessionId, result.status, JSON.stringify(result.body));
    return json(result.status, result.body);
  } catch (e) {
    // Stripe or the database did not answer. Nothing was claimed, or the
    // claim is recorded; either way a retry is safe.
    console.error('[stripe-webhook]', event.id, e);
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
});
