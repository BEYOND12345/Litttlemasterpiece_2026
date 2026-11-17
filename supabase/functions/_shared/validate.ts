/**
 * Request bodies from the browser. Everything a browser sends is treated as
 * a request, never as a fact: a body may name a product and a look, and an
 * order id, and nothing else is read from it. A price in a body is ignored,
 * not rejected, so a tampered request simply gets the database price.
 *
 * Pure: no Deno, no network.
 */

export const LOOKS = ['as_drawn', 'screen_print'] as const;
export type Look = (typeof LOOKS)[number];

/** A 4xx the caller can act on. The message is shown to the parent. */
export class BadRequest extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BadRequest';
    this.status = status;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);

/** Stripe Checkout Session ids: cs_test_... or cs_live_..., letters and digits. */
const SESSION_RE = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
export const isCheckoutSessionId = (s: unknown): s is string => typeof s === 'string' && SESSION_RE.test(s);

const SLUG_RE = /^[a-z][a-z0-9_]{0,31}$/;
export const isLook = (s: unknown): s is Look => typeof s === 'string' && (LOOKS as readonly string[]).includes(s);

const asObject = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('Expected a JSON object.');
  return body as Record<string, unknown>;
};

export function parseCreateOrder(body: unknown): { product: string; look: Look } {
  const b = asObject(body);
  if (typeof b.product !== 'string' || !SLUG_RE.test(b.product)) throw new BadRequest('Unknown product.');
  if (!isLook(b.look)) throw new BadRequest('Unknown look.');
  return { product: b.product, look: b.look };
}

export function parseCreateCheckout(body: unknown): { orderId: string } {
  const b = asObject(body);
  if (!isUuid(b.orderId)) throw new BadRequest('Missing or malformed order id.');
  return { orderId: b.orderId.toLowerCase() };
}

export function parseOrderStatus(body: unknown): { sessionId: string } {
  const b = asObject(body);
  if (!isCheckoutSessionId(b.sessionId)) throw new BadRequest('Missing or malformed checkout session id.');
  return { sessionId: b.sessionId };
}

/** Length-independent string compare, for shared-secret tokens. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
