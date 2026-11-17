/**
 * create-order: the browser says which gift and which look. This makes a
 * pending gift_orders row and a ONE-TIME signed upload URL for that order's
 * print file in the private bucket. No price is taken from or returned to
 * the browser here; nothing is charged; Gelato is not called.
 *
 * POST { product: 'framed' | 'mug', look: 'as_drawn' | 'screen_print' }
 *   -> 200 { orderId, path, token, print: { width, height } }
 *   -> 409 when the product is not sellable yet (no Gelato product UID)
 */
import { admin, corsFor } from '../_runtime/clients.ts';
import { PRINT_BUCKET, assertSellable, type ProductRow } from '../_shared/checkout.ts';
import { NOTHING_CHARGED, errorResponse, json } from '../_shared/http.ts';
import { parseCreateOrder } from '../_shared/validate.ts';

Deno.serve(async (req) => {
  let cors: Record<string, string> = {};
  try {
    cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json(405, { error: 'Use POST.' }, cors);

    const { product: slug, look } = parseCreateOrder(await req.json().catch(() => null));
    const db = admin();

    const { data: product, error: productError } = await db
      .from('gift_products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (productError) throw productError;
    assertSellable(product as ProductRow | null);
    const p = product as ProductRow;

    const { data: order, error: insertError } = await db
      .from('gift_orders')
      .insert({ product: p.slug, look })
      .select('id, print_file_path')
      .single();
    if (insertError) throw insertError;

    // upsert stays off: the token can write this one path once, and a second
    // upload cannot swap the file after the order is paid.
    const { data: upload, error: uploadError } = await db.storage
      .from(PRINT_BUCKET)
      .createSignedUploadUrl(order.print_file_path);
    if (uploadError) throw uploadError;

    return json(
      200,
      {
        orderId: order.id,
        path: upload.path,
        token: upload.token,
        print: { width: p.print_width_px, height: p.print_height_px },
      },
      cors,
    );
  } catch (e) {
    return errorResponse(e, cors, 'create-order', NOTHING_CHARGED);
  }
});
