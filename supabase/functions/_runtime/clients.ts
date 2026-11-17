/**
 * Deno-only wiring: secrets, the service-role Supabase client, Stripe.
 * Everything that can be tested without these lives in ../_shared.
 *
 * Secrets (supabase secrets set ..., never VITE_ variables):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GELATO_API_KEY, SITE_URL,
 *   GELATO_ORDER_TYPE (optional, "order" to print for real; anything else is a draft),
 *   GELATO_WEBHOOK_SECRET (gelato-webhook only), ALLOWED_ORIGINS (optional, comma separated).
 * Provided by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 * Versions are pinned and match package.json (stripe devDependency for the
 * tests, @supabase/supabase-js for the app), so the code the tests and
 * `npm run typecheck:functions` check is the code that runs here.
 */
import Stripe from 'npm:stripe@18.5.0';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { allowedOrigins, corsHeaders } from '../_shared/cors.ts';

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v || !v.trim()) throw new Error(`Missing secret ${name}`);
  return v.trim();
}

let db: SupabaseClient | null = null;
/** Service role: bypasses RLS. Only ever used inside these functions. */
export function admin(): SupabaseClient {
  db ??= createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return db;
}

let stripe: Stripe | null = null;
export function stripeClient(): Stripe {
  stripe ??= new Stripe(requireEnv('STRIPE_SECRET_KEY'), {
    // fetch, not Node's http: this is Deno.
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });
  return stripe;
}

/** WebCrypto HMAC for webhook signatures; Deno has no Node crypto by default. */
export const stripeCrypto = Stripe.createSubtleCryptoProvider();

/** CORS headers for this request, from SITE_URL (+ ALLOWED_ORIGINS). */
export function corsFor(req: Request): Record<string, string> {
  return corsHeaders(req.headers.get('origin'), allowedOrigins(requireEnv('SITE_URL'), Deno.env.get('ALLOWED_ORIGINS')));
}
