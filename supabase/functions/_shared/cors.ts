/**
 * CORS for the three functions the browser calls (create-order,
 * create-checkout, order-status). The webhooks are server-to-server and send
 * no CORS headers.
 *
 * CORS is the browser's rule, not a lock: anything outside a browser can call
 * these functions with the public anon key, which is why none of them trusts
 * its caller for a price, a status or a file path.
 *
 * Pure: no Deno.
 */

/** The site's origin from SITE_URL, plus any extra origins (comma separated). */
export function allowedOrigins(siteUrl: string, extra?: string | null): string[] {
  const out: string[] = [];
  const add = (u: string) => {
    try {
      const o = new URL(u.trim()).origin;
      if (o !== 'null' && !out.includes(o)) out.push(o);
    } catch {
      // Not a URL: ignored rather than allowed.
    }
  };
  add(siteUrl);
  for (const u of (extra ?? '').split(',')) if (u.trim()) add(u);
  if (out.length === 0) throw new Error('SITE_URL is not a valid URL');
  return out;
}

export function corsHeaders(requestOrigin: string | null, allowed: string[]): Record<string, string> {
  const origin = requestOrigin && allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
