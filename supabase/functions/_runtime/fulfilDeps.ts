/**
 * The real dependencies for _shared/fulfil.ts: gift_orders through the
 * service role, the private print bucket, and the one Gelato POST.
 *
 * Every status write names the status it expects to move FROM, so a write
 * that lost a race changes nothing instead of overwriting the winner; the
 * gift_orders_guard trigger refuses any move not in the status machine.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { FulfilDeps } from '../_shared/fulfil.ts';
import type { OrderRow, ProductRow } from '../_shared/checkout.ts';
import { PRINT_BUCKET } from '../_shared/checkout.ts';
import {
  GELATO_ORDERS_URL,
  PRINT_FILE_URL_TTL_SECONDS,
  gelatoNetworkFailure,
  gelatoOrderType,
  interpretGelatoResponse,
} from '../_shared/gelato.ts';

const ORDER_COLUMNS = 'id, product, look, print_file_path, status, stripe_session_id, amount_cents, currency, gelato_order_id';

/** Long enough for a slow answer, short enough to finish inside the function's time limit. */
const GELATO_TIMEOUT_MS = 25_000;

export function fulfilDeps(db: SupabaseClient): FulfilDeps {
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  return {
    orderType: gelatoOrderType(Deno.env.get('GELATO_ORDER_TYPE')),

    async getOrder(id) {
      const { data, error } = await db.from('gift_orders').select(ORDER_COLUMNS).eq('id', id).maybeSingle();
      fail('read order', error);
      return (data as OrderRow | null) ?? null;
    },

    async getProduct(slug) {
      const { data, error } = await db.from('gift_products').select('*').eq('slug', slug).maybeSingle();
      fail('read product', error);
      return (data as ProductRow | null) ?? null;
    },

    async markPaid(id, paid) {
      const { data, error } = await db
        .from('gift_orders')
        .update({
          status: 'paid',
          stripe_session_id: paid.stripeSessionId,
          customer_email: paid.email,
          marketing_opt_in: paid.marketingOptIn,
          shipping: paid.shipping,
          paid_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
      fail('mark paid', error);
      return (data ?? []).length > 0;
    },

    async claim(id) {
      const { data, error } = await db.rpc('claim_gift_order', { p_order_id: id });
      fail('claim order', error);
      const rows = (data ?? []) as OrderRow[];
      return rows[0] ?? null;
    },

    async markSubmitted(id, gelatoOrderId) {
      const { data, error } = await db
        .from('gift_orders')
        .update({ status: 'in_production', gelato_order_id: gelatoOrderId, submitted_at: new Date().toISOString(), last_error: null })
        .eq('id', id)
        .eq('status', 'submitting')
        .select('id');
      fail('record Gelato order', error);
      if ((data ?? []).length === 0) throw new Error(`order ${id} was no longer submitting`);
    },

    async markFailed(id, message) {
      const { error } = await db
        .from('gift_orders')
        .update({ status: 'fulfilment_failed', last_error: message.slice(0, 2000) })
        .eq('id', id)
        .eq('status', 'submitting');
      fail('record failure', error);
    },

    async noteError(id, message) {
      const { error } = await db.from('gift_orders').update({ last_error: message.slice(0, 2000) }).eq('id', id);
      fail('note error', error);
    },

    async signedFileUrl(path) {
      const { data, error } = await db.storage.from(PRINT_BUCKET).createSignedUrl(path, PRINT_FILE_URL_TTL_SECONDS);
      fail('sign print file URL', error);
      if (!data?.signedUrl) throw new Error('no signed URL returned');
      return data.signedUrl;
    },

    async createGelatoOrder(payload) {
      const key = Deno.env.get('GELATO_API_KEY')?.trim();
      // Nothing left the building, so this is a plain, retryable failure.
      if (!key) return { kind: 'rejected', message: 'GELATO_API_KEY is not set; nothing was sent' };
      let res: Response;
      try {
        res = await fetch(GELATO_ORDERS_URL, {
          method: 'POST',
          headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(GELATO_TIMEOUT_MS),
        });
      } catch (e) {
        return gelatoNetworkFailure(e);
      }
      let text = '';
      try {
        text = await res.text();
      } catch (e) {
        // Headers arrived, body did not: on a 2xx Gelato may have the order.
        return res.ok ? gelatoNetworkFailure(e) : { kind: 'rejected', message: `Gelato ${res.status}` };
      }
      return interpretGelatoResponse(res.status, text);
    },
  };
}
