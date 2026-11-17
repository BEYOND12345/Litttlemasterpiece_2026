/**
 * The two Deno globals the Edge Functions use, declared for
 * `npm run typecheck:functions` (tsconfig.functions.json) only. Deno itself
 * supplies the real ones; this file is never deployed or bundled.
 */
declare namespace Deno {
  export const env: { get(key: string): string | undefined };
  export function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
}

/** `npm:stripe@18.5.0` is the same package as the `stripe` devDependency. */
declare module 'npm:stripe@18.5.0' {
  import Stripe from 'stripe';
  export default Stripe;
}
