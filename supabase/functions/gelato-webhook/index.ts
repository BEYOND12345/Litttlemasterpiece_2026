/**
 * gelato-webhook: Gelato's order_status_updated events move a sent order to
 * shipped / delivered / cancelled. This RECEIVES from Gelato and never calls
 * it; stripe-webhook stays the only caller.
 *
 * Gelato's webhooks are not signed, so the URL carries a long random token
 * (GELATO_WEBHOOK_SECRET) and anything without it is refused. Even with it,
 * an event can only move an order along the status machine, and only when
 * it names the Gelato order id we recorded for that order.
 *
 * Deploy with --no-verify-jwt. Register in Gelato as
 *   https://<project-ref>.supabase.co/functions/v1/gelato-webhook?token=<GELATO_WEBHOOK_SECRET>
 */
import { admin, requireEnv } from '../_runtime/clients.ts';
import { gelatoStatusUpdate, parseGelatoStatusEvent } from '../_shared/gelato.ts';
import { json } from '../_shared/http.ts';
import type { OrderStatus } from '../_shared/status.ts';
import { isUuid, safeEqual } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  try {
    const token = new URL(req.url).searchParams.get('token') ?? '';
    if (!safeEqual(token, requireEnv('GELATO_WEBHOOK_SECRET'))) return json(401, { error: 'bad token' });

    const event = parseGelatoStatusEvent(await req.json().catch(() => null));
    if (!event) return json(200, { ignored: 'not an order_status_updated event' });
    if (!isUuid(event.orderReferenceId)) return json(200, { ignored: 'not one of our order ids' });

    const db = admin();
    const { data, error } = await db
      .from('gift_orders')
      .select('id, status, gelato_order_id')
      .eq('id', event.orderReferenceId.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return json(200, { ignored: 'no such order' });

    const order = data as { id: string; status: OrderStatus; gelato_order_id: string | null };
    const update = gelatoStatusUpdate(order, event);
    if (!update.matches) return json(200, { ignored: 'Gelato order id does not match ours' });

    const patch: Record<string, unknown> = { gelato_status: update.gelato_status };
    if (update.status) patch.status = update.status;
    const { error: writeError } = await db
      .from('gift_orders')
      .update(patch)
      .eq('id', order.id)
      .eq('status', order.status);
    if (writeError) throw writeError;
    return json(200, { status: update.status ?? order.status, gelato_status: update.gelato_status });
  } catch (e) {
    console.error('[gelato-webhook]', e);
    return json(500, { error: 'could not record the status' });
  }
});
