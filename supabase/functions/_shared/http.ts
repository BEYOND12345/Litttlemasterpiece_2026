/**
 * JSON responses and the one place errors become HTTP. Response is a global
 * in both Deno and Node 22, so this stays testable.
 */
import { BadRequest } from './validate.ts';

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * A BadRequest carries a message meant for the parent. Anything else is our
 * fault: logged in full, answered with a plain sentence that leaks nothing.
 */
export function errorResponse(
  err: unknown,
  headers: Record<string, string> = {},
  where = 'function',
  publicMessage = 'Something went wrong on our side. Please try again.',
): Response {
  if (err instanceof BadRequest) return json(err.status, { error: err.message }, headers);
  console.error(`[${where}]`, err);
  return json(500, { error: publicMessage }, headers);
}

/** For the two functions that run before payment: true there, and worth saying. */
export const NOTHING_CHARGED = 'Something went wrong on our side. Nothing has been charged. Please try again.';
