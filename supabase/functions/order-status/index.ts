/**
 * order-status: what the return page shows after Stripe sends the parent
 * back with ?session_id=cs_... . Product, look and status: no name, email,
 * address, amount or any provider id.
 *
 * POST { sessionId } -> 200 { product, look, status } | 404
 */
import { admin, corsFor } from '../_runtime/clients.ts';
import { errorResponse, json } from '../_shared/http.ts';
import { BadRequest, parseOrderStatus } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  let cors: Record<string, string> = {};
  try {
    cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' }, cors);

    const { sessionId } = parseOrderStatus(await req.json().catch(() => null));
    const { data, error } = await admin()
      .from('gift_orders')
      .select('product, look, status')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new BadRequest('We could not find that order.', 404);
    return json(200, { product: data.product, look: data.look, status: data.status }, cors);
  } catch (e) {
    return errorResponse(e, cors, 'order-status');
  }
});
